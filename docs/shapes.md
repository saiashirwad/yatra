# Shapes

The select surface becomes object literals; nesting, sub-shape filters, grouping, and set ops follow. All of it desugars to the IR in ir-and-scopes.md — no new core machinery beyond what that doc defines.

## Idea

1. `select` takes an object; **the key is the alias**. Tuples + `as()` remain the low-level form.
2. Nested collections are shapes over relations: `many(rel, fn, opts?)` / `one(rel, fn, opts?)`, with cardinality from relation metadata. This subsumes `jsonAgg`.
3. Sub-shapes take `where` / `orderBy` / `limit` — "each author with their 5 cheapest books" stays inside the shape language.
4. Shape ⇒ nested result; plain columns ⇒ flat. The `hydrate` step leaves the sweet path (kept for the low-level tuple form).
5. `group` / `having` / `distinct` make aggregates first-class. `sum` / `avg` / `min` / `max` / `count` are op-pack builders, not core.
6. Set ops are query-value combinators: `union` / `intersect` / `except`.

Prior art is unanimous on object shapes for nested reads (EdgeQL shapes, Prisma `select`, Drizzle `with:`); nobody chose a trailing mode toggle.

## Object select

```ts
const q = pipe(
  Author,
  query,
  select(t => ({
    id: t.id,
    name: t.name,
    bookCount: count(t.books), // key is the alias — no as()
    books: many(t.books, b => ({
      title: b.title,
      price: b.price
    }))
  })),
  where(t => ilike(t.name, "%rowling%"))
)
```

Desugars to exactly today's IR: each entry becomes the same node the tuple would hold; `many(rel, fn)` becomes the array-agg node. Nothing in the kind vocabulary changes.

What this deletes from the codebase: `as()` from the common path (kept for `orderBy` on aliased exprs), `RequireTuple`, the "expressions need an alias" branch of `CheckItem`, the visible flat/hydrate split, and dotted `"books.name"` result keys in flat mode.

Fragments compose by spread, and key collision is a type error instead of a silent duplicate column:

```ts
const bookCard = (b: AnyAccessor<typeof Book>) => ({
  id: b.id,
  title: b.title
})

select(t => ({
  name: t.name,
  books: many(t.books, b => ({ ...bookCard(b) }))
}))
```

## Filtered / ordered / limited sub-shapes

The biggest expressiveness gap today: no way to filter or limit a nested collection (`link(rel, cond)` filters the join, not the array — with left-join semantics it nulls non-matches rather than shrinking the array). One options bag on the same node:

```ts
books: many(
  t.books,
  b => ({ title: b.title, price: b.price }),
  {
    where: b => gt(b.price, 10),
    orderBy: b => desc(b.price),
    limit: 5
  }
)
```

Desugars to optional `where` / `order` / `limit` fields on the agg-over-statement node (ir-and-scopes.md). Postgres renders a filtered/lateral `jsonb_agg` subquery; memory filters before collecting. Filter specs are plain values too: `const cheap = { where: b => lt(b.price, 10) }` spreads into any shape.

## Grouping and free-standing aggregates

Today you cannot count a table — `count` is relation-shaped only. Two context fields (same append semantics as `where`, so fragments compose) and an op pack:

```ts
pipe(
  Book,
  query,
  group(t => [t.authorId]),
  select(t => ({
    authorId: t.authorId,
    n: count(),
    avgPrice: avg(t.price)
  })),
  having(t => gt(count(), 3))
)
```

`group` changes row cardinality semantics — that is structure, not vocabulary, so it belongs in (near-)core; the aggregate builders/renderers stay in the op pack. `distinct` is one field on the statement; take it, don't make users emulate it with `group`.

## Set ops

```ts
const both = pipe(cheap, union(pricey))
const overlap = pipe(cheap, intersect(pricey))
const onlyCheap = pipe(cheap, except(pricey))
```

One node — `{ kind: "setop", op, left, right }` — wrapping two query values. Relational-algebra closure, pure by construction. Note for query-values-and-scopes.md: `recursive` is fixpoint over union (base + step under a self-reference); saying so makes it feel discovered rather than invented.

## Ergonomics pack (zero IR change)

- Steps accept `Table` directly: `pipe(Author, select(...), where(...))` — a table is the empty context; `query` stays exported as the explicit form. Mutations already work this way.
- Falsy-tolerant `where` / `orderBy`: `where(t => [minPrice && gte(t.price, minPrice)])` drops falsy entries, so conditional composition stays inside the pipe (Kysely needed `$if` for this; yatra gets it nearly free).
- Ship fragment type aliases (`SelFrag<T>`, `PredFrag<T>`) — the chain-generic accessor signature is the steepest tax in the API and every user will copy it.
- Rename `whereExists` → `exists` (the docs already say `exists`; the code lags).
- Key the IR selection by path: repeated selects contributing `t.id` become idempotent instead of duplicate columns. Hydration already thinks in paths; align the IR with it.

## Resist

- Window functions in core — an op pack can add `rowNumber(over(...))` later via open `expr` tags.
- `innerJoin` / `leftJoin` / `joinLateral` verbs — link-and-joins.md already refuses; hold the line.
- Named sources / `with(name, query)` — query values stay nameless.
- A query-syntax DSL or template strings — pipe + shapes gets ~95% of the readability without a macro layer.
- Pagination steps — keyset is `where` + `orderBy` + `limit`; ship a userland recipe, cursor encoding stays an app concern.
- Multi-accessor `select((a, c) => ...)` as the happy path — positional arity grows with every `link` (this is what drove LINQ to invent query syntax). Paths and shapes cover almost everything; `link` + multi-accessor select is the escape hatch, not the default.

## Vocabulary

| Keep                                                                                                                           | Rename                   | De-emphasize                                                                                   | Add                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `query`, `select`, `where`, `orderBy`, `limit`, `offset`, `link`, `recursive`, `materialize`, `run` / `runOne`, `asc` / `desc` | `whereExists` → `exists` | `as` (shapes subsume it), `hydrate` (shapes imply it), `jsonAgg` (low-level node under `many`) | `many` / `one`, `group`, `having`, `distinct`, `union` / `intersect` / `except`; `sum` / `avg` / `min` / `max` / bare `count()` (op pack) |

## Status

Mostly implemented. Object select (key = alias, tuples kept as the
low-level form), `many` / `one` with `where` / `orderBy` / `limit`
sub-shape filters, `group` / `having` / `distinct`, the aggregate op
pack (bare `count()`, `sum` / `avg` / `min` / `max`), set ops
(`union` / `intersect` / `except`), falsy-tolerant `where` /
`orderBy`, `whereExists` → `exists`, and the fragment aliases
(`AnyAccessor`, `SelFrag`, `PredFrag`) all landed, parity-tested on
both backends. Two deliberate deviations: unordered sub-shape
collections and set-op results come back in a canonical order
(jsonb ordering / result-column order) so every backend agrees; and
`hydrate` stays for the tuple form rather than leaving the API.
Steps-accept-`Table`-directly is not done; `query` stays explicit.
