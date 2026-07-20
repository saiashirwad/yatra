# Link and joins

Joins are not a single core verb. They fall out of **using related sources** and, when needed, a small hook to **bring another source into scope**. Sugar (`innerJoin`, domain helpers) can live in userland.

## Idea

1. **Default:** using a relation in a ref (`t.books.title`) is enough. The compiler adds the joins implied by that chain.
2. **Explicit control:** a generic step, `link`, opens a related source (or a query value) and optionally attaches a condition.
3. **Policy** (left vs required match, extra `ON` predicates) is optional configuration on `link`, not a separate API surface for every join kind.
4. Users compose their own helpers on top of `link` the same way they compose predicate fragments.

`select` stays about shape. Row-set topology stays about sources + links + filters (`where` / `exists`).

## Why this shape

Problems we are separating:

1. **Projection** — which fields appear in the result (`select`, hydrate).
2. **Topology** — which sources are in scope and how they match (`link`, inferred joins).
3. **Filtering** — which left-hand rows survive (`where`, `exists`).
4. **Physical plan** — SQL `JOIN`, multi-query, in-memory nested loops (compiler / executor).

Mixing (1)–(3) into one “join API” forces every use case through the same surface (include blobs, or always-explicit SQL joins). Splitting them matches how the IR already works: refs demand paths; steps change context; the compiler chooses SQL.

`link` is the smallest explicit topology step: **bring another source into scope and say how it matches.** It is not required when a ref already implies the path. It is not a full join DSL.

Operationally, for each left row, matching right rows are associated (and optionally left rows with no match are dropped). That is the same idea whether the backend emits `LEFT JOIN` or does index lookups in memory.

## Related prior art

Same _job_ appears under different names. None of these is a one-to-one copy of this design; they are reference points.

| System                 | Mechanism                                                                      | Overlap with `link`                                                                  |
| ---------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| **SQLAlchemy**         | `select(...).join(User.addresses)`; relationship can carry ON + extra `and_()` | Join via relation metadata instead of hand-written keys; optional extra predicate    |
| **EdgeDB / Gel**       | Schema **links**; EdgeQL nested shapes with filters on the link                | Relation is first-class; navigate + filter + nested shape without spelling SQL joins |
| **Entity Framework**   | Navigations; `Include` / filtered include; explicit `Join`                     | Path-based related load vs manual join                                               |
| **LINQ**               | Using `a.Books` in a query implies a join; separate explicit `join`            | Default from navigation + explicit when needed                                       |
| **Prisma**             | `include` / nested `where` on relations                                        | Nested shape + related filter; config object, not a pipe step                        |
| **Drizzle**            | Relational `query` API (`with: { books: true }`) vs SQL `leftJoin`             | Two lanes: nested read helper vs SQL join                                            |
| **Objection.js**       | `withGraphJoined` / `withGraphFetched`                                         | Same relation graph; joined SQL vs multi-query fetch (plan split)                    |
| **Kysely**             | Explicit `leftJoin` only; no built-in relations                                | Thin builder; relations/helpers left to user code                                    |
| **Relational algebra** | Join (⋈) as an operator on two relations + condition                           | `link` is that operator with a friendlier binding to schema paths / query values     |

**What is already common:** relationship metadata drives ON clauses; nested includes attach related data; filters on related rows; left vs inner semantics.

**What this doc is committing to specifically:**

- One small step (`link`) for topology, not a family of `innerJoin` / `leftJoin` / `joinLateral` core verbs.
- The same step for **schema relations** and **query values** (intermediates), instead of separate “include” vs “join subquery” APIs.
- **Inference still default** when refs mention a path (LINQ / current Yatra behavior).
- **Userland sugar** on top of `link` (same spirit as composable ops / fragments), rather than baking every join variant into core.
- Plan (SQL join vs client match) is not part of the user-facing verb.

## Design constraints (spirit)

- Prefer composing functions over growing a large join vocabulary in core.
- Prefer `exists` when the other side is only used to filter, so parent row counts stay stable.
- Prefer left match by default so partial shapes and hydrate null/empty arrays stay consistent.
- Do not require the user to name SQL join order or aliasing for the common case.
- Keep the step backend-agnostic: IR means “associate these sources”; SQL is one encoding.
- Prefer paths and shapes (shapes.md) on the happy path. Multi-accessor callbacks (`select((a, c) => ...)`) are the escape hatch, not the default — positional arity grows with every `link`.

## Automatic joins

No `link` required:

```ts
pipe(
  Author,
  query,
  select(t => [t.id, t.name, t.books.title]),
  where(t => ilike(t.books.title, "%earth%")),
  hydrate
)
```

The compiler walks relation chains on the refs and emits joins (today: left joins from FK metadata).

## Explicit `link` on a relation

Declare a path without waiting for a column use, or attach an extra condition:

```ts
pipe(
  Author,
  query,
  link(t => t.books),
  select(t => [t.id, t.books.title])
)
```

```ts
pipe(
  Author,
  query,
  link(
    t => t.books,
    b => eq(b.published, true)
  ),
  select(t => [t.id, t.name, t.books.title]),
  hydrate
)
```

## Link a query value

Same hook; the other side is any query (projection / intermediate), not only a schema relation. This subsumes a standalone `join` step: `link` with the default left policy is a left join, and `{ match: "required" }` is the inner variant:

```ts
const cheap = pipe(
  Book,
  query,
  select(t => [t.id, t.authorId, t.price]),
  where(t => lt(t.price, 10))
)

pipe(
  Author,
  query,
  link(cheap, (a, c) => eq(a.id, c.authorId)),
  select((a, c) => [a.name, c.price])
)
```

## Stacking

```ts
pipe(
  Author,
  query,
  link(t => t.books),
  link(t => t.books.publisher),
  select(t => [
    t.name,
    t.books.title,
    t.books.publisher.name
  ]),
  hydrate
)
```

## Userland helpers

Core does not need `innerJoin` / `leftJoin` as primitives. Build them from `link`:

```ts
// sketch
const inner = (rel, on?) =>
  link(rel, on, { match: "required" })

pipe(
  Author,
  query,
  inner(t => t.books),
  select(t => [t.id, t.books.title])
)
```

Domain-specific:

```ts
const activeBooks = link(
  t => t.books,
  b => eq(b.active, true)
)

pipe(
  Author,
  query,
  activeBooks,
  select(t => [t.id, t.books.name]),
  hydrate
)
```

## Filter without linking columns

When you only need “has matching related rows,” prefer exists-style composition so you do not multiply parent rows:

```ts
pipe(
  Author,
  query,
  where(t => exists(t.books, b => lt(b.price, 10))),
  select(t => [t.id, t.name])
)
```

Or against a query value:

```ts
pipe(
  Author,
  query,
  where(t => exists(cheap, c => eq(c.authorId, t.id))),
  select(t => [t.id, t.name])
)
```

| Goal                                       | Prefer             |
| ------------------------------------------ | ------------------ |
| Related fields in the result shape         | refs and/or `link` |
| Parent rows that match a related predicate | `exists`           |
| Connect to a non-relation query            | `link(query, on)`  |

## What stays core vs userland

| Core (or near-core)                                 | Userland                            |
| --------------------------------------------------- | ----------------------------------- |
| Relation metadata (keys, cardinality)               | `inner`, `left`, named domain links |
| Ref chains → join inference                         | App-specific join packages          |
| `link` (source + optional condition + match policy) | Sugar over `link`                   |
| `exists` over relation or query value               | Helpers like `hasCheap`             |

## Defaults

- Inferred joins: **left**, so missing relations stay null / empty under hydrate.
- Explicit `{ match: "required" }` (name TBD): drop parents with no match (inner semantics).
- Join _order_ is not a primary API; the compiler owns physical plan unless a backend needs more later.

## Layering

```
refs in select/where  →  demand a path (inference)
link(...)             →  open/refine a source in scope
exists(...)           →  correlate without projecting the other side
compiler              →  LEFT/INNER JOIN, subquery, etc.
```

## Status

Design note, not implemented API. Current Yatra only does automatic left joins from relation chains. `link`, match policy, link-to-query, and `exists` over query values are future work on the same pipe + IR model.
