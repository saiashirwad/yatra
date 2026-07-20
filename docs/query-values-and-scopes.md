# Query values and scopes

Intermediates (CTEs, subqueries, recursive walks) are modeled as **query values**, not named registry entries. You bind them with `const`, compose them into larger queries, and leave SQL details (`WITH`, inlining, client multi-step) to the compiler.

## Idea

1. A query is a value: `const q = pipe(...)`.
2. Other steps can take that value (`exists`, `join`, `semiJoin`, further `pipe`).
3. There is no `asSource("name")` or `withSources(...)` in the API.
4. If the same value appears more than once, or recursion is required, a backend may emit a CTE (or equivalent). If not, it may inline or run multiple round-trips.

Schema stays tables/relations. Read shapes stay projections. Intermediate queries are just more projections you can reuse.

## Define an intermediate

```ts
const cheap = pipe(
  Book,
  query,
  select(t => [t.id, t.authorId, t.price]),
  where(t => lt(t.price, 10))
)
```

`cheap` is a normal query whose result shape is only those columns.

## Use it in a filter

```ts
const q = pipe(
  Author,
  query,
  select(t => [t.id, t.name]),
  where(t => exists(cheap, c => eq(c.authorId, t.id)))
)
```

- `exists` takes a query value and a predicate.
- `c` is the intermediate’s shape; `t` is the outer query (correlation via closure).
- No string name for the intermediate.

## Reuse

```ts
const q = pipe(
  Author,
  query,
  select(t => [
    t.id,
    t.name,
    as(
      count(cheap, c => eq(c.authorId, t.id)),
      "cheapCount"
    )
  ]),
  where(t => exists(cheap, c => eq(c.authorId, t.id)))
)
```

Same `cheap` value twice. A SQL compiler may emit `WITH ... AS (...)`; that is a plan choice, not part of the user API.

## Join

```ts
const q = pipe(
  Author,
  query,
  semiJoin(cheap, (a, c) => eq(a.id, c.authorId)),
  select(a => [a.id, a.name])
)
```

Or keep columns from both sides:

```ts
const q = pipe(
  Author,
  query,
  join(cheap, (a, c) => eq(a.id, c.authorId)),
  select((a, c) => [a.id, a.name, c.price])
)
```

## Refine an intermediate

```ts
const veryCheap = pipe(
  cheap,
  where(t => lt(t.price, 5))
)

const q = pipe(
  Author,
  query,
  where(t => exists(veryCheap, c => eq(c.authorId, t.id))),
  select(t => [t.id, t.name])
)
```

Pipe continues from an existing query value the same way it continues from `query`.

## Relation-only exists

When you only need “related rows match,” you do not need a free-standing intermediate:

```ts
const q = pipe(
  Author,
  query,
  select(t => [t.id, t.name]),
  where(t => exists(t.books, b => lt(b.price, 10)))
)
```

Use a query value when the intermediate is its own projection (subset of columns, extra filters, aggregates), not only a relation walk.

## Recursion

Recursive walks are also query values: base case + step that may read the accumulating result.

```ts
const orgTree = recursive({
  base: pipe(
    Employee,
    query,
    select(t => [
      t.id,
      t.name,
      t.managerId,
      as(lit(0), "depth")
    ]),
    where(t => isNull(t.managerId))
  ),
  step: tree =>
    pipe(
      Employee,
      query,
      select(t => [
        t.id,
        t.name,
        t.managerId,
        as(add(tree.depth, 1), "depth")
      ]),
      where(t => eq(t.managerId, tree.id))
    )
})

const q = pipe(
  orgTree,
  where(t => lt(t.depth, 5)),
  select(t => [t.id, t.name, t.depth])
)
```

On Postgres this may become `WITH RECURSIVE`. On another backend it may become path expansion, a fixed-depth unrolling, or a client-side loop, depending on capabilities.

## Optional materialize hint

Identity is still the value, not a name. A step can only hint how to run it:

```ts
const cheap = pipe(
  Book,
  query,
  select(t => [t.id, t.authorId, t.price]),
  where(t => lt(t.price, 10)),
  materialize() // e.g. prefer CTE / temp / client cache; default remains auto
)
```

## Plan choices (compiler / runtime)

Same IR, different execution:

| Situation                       | Possible plan                                  |
| ------------------------------- | ---------------------------------------------- |
| Intermediate used once          | Inlined subquery                               |
| Intermediate used several times | CTE (`WITH`)                                   |
| Recursive                       | `WITH RECURSIVE`, graph path, or client expand |
| Backend cannot express it       | Multi-step client materialization              |
| Explicit hint                   | Force CTE, inline, client, etc.                |

## Layering

| Layer    | Responsibility                                         |
| -------- | ------------------------------------------------------ |
| API      | Query values, project, filter, join, exists, recursive |
| IR       | Scopes, correlation, result shapes                     |
| Compiler | SQL / Cypher / pipeline / multi-query                  |
| Runtime  | Execute the plan                                       |

Portable concepts live in the IR (projection, filter, named intermediate as a value, expand/recurse). Dialect-specific syntax stays in the compiler.

## Status

This is a design note, not implemented API. Current Yatra has single-scope `query` / `select` / `where` and a Postgres compiler. Scopes, `exists` over query values, join-to-query, recursion, and materialize hints are future work built on the same pipe + IR direction.
