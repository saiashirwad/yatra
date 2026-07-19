# yatra

A playground for exploring ideas for a new, extremely type-safe, extremely
composable ORM for TypeScript. Currently designed only with Postgres in mind.

The frontend (schema definition, composable query builder, result types, SQL
compilation) is real and working; there is intentionally no database driver
behind it yet — the query pipeline compiles to parameterized SQL strings plus a
row hydrator, so any backend can be plugged in later.

Runs on plain Node 24+ (native type stripping, no build step) with pnpm.

```sh
pnpm install
pnpm demo        # node examples/demo.ts
pnpm typecheck   # tsc --noEmit (includes compile-time type tests)
```

## Defining tables

```typescript
class Author extends Table("author", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  description: pipe(string, nullable),
  createdAt: pipe(date, defaultValue(new Date()))
}) {
  get books() {
    return oneToMany(
      () => Author,
      () => Book,
      "author.id",
      "book.authorId"
    )
  }
}
```

- Columns are values (`string`, `uuid`, `date`, `jsonb`, …) refined by
  piping properties onto them (`nullable`, `primaryKey`, `defaultValue`,
  `unique`, `minLength`, `references`, …). Properties are phantom-typed, so
  things like nullability show up in the result types.
- Relations are lazy getters returning `oneToOne` / `oneToMany` /
  `manyToOne` / `manyToMany`, so circular references between tables just work.

## Composing queries

Queries are built by piping a table through composable steps. Every step is
just a function `(ctx) => ctx`, so you can define and share your own.

```typescript
const withBooks = pipe(
  Author,
  query,
  select(
    "id",
    "name",
    jsonAgg("books", [
      "id",
      "name",
      "price",
      jsonAgg("tags", ["id", "name"]) // blocks nest
    ]),
    count("books", { as: "bookCount" })
  ),
  where("name", "ilike", "%rowling%"),
  orderBy("name", "asc"),
  limit(10)
)

type Rows = Result<typeof withBooks>
// {
//   id: string
//   name: string
//   books: { id: string; name: string; price: number | null;
//            tags: { id: string; name: string }[] }[]
//   bookCount: number
// }[]

const compiled = toSQL(withBooks) // { dialect, sql, params }
```

- `select(...)` takes validated path strings — `"id"`, `"books.name"`,
  `"books.tags.id as tagId"` — with **incremental autocomplete**: typing
  `"b"` suggests `"books."`, accepting it suggests every field of Book
  (`"books.id"`, `"books.name"`, …), and so on segment by segment (the
  `playground/blass.ts` trick — the pipe infers the table from the
  previous step, so the expected type at the position you're typing is
  the union of valid continuations). Typos are compile-time errors that
  name the valid keys. Also composable blocks like `jsonAgg(...)` and
  `count(...)` that can be defined once and reused across queries.
- `where(path, op, value)` checks the value against the column type at the
  end of the path (`"in"` wants an array, `"is"` wants `null`, a number
  column wants a number…). Multiple `where`s are ANDed.
- `hydrate` switches the query into nested mode: dotted paths become nested
  objects/arrays based on relation cardinality (to-many → array,
  to-one → object | null), both in the result type and in the compiled SQL.

## Hydrated joins

```typescript
const q = pipe(
  Author,
  query,
  select(
    "id",
    "name",
    "books.id",
    "books.name",
    "books.tags.id"
  ),
  hydrate
)

const { sql } = toSQL(q) // one flat query, LEFT JOINs,
// columns aliased books__id, …
const rows = await db.query(sql) // any driver
const authors = hydrateRows(q, rows) // typed as Result<typeof q>
```

## Swapping backends

Compilation goes through a tiny interface, so other dialects/targets can be
added without touching the builder:

```typescript
interface Compiler {
  readonly dialect: string
  compile(ctx: QueryContext<any, any, any>): CompiledQuery
}

pipe(Author, query, select("id"), compileWith(postgres))
```

`postgres` (in `src/compile.ts`) is the reference implementation: LEFT JOINs
for dotted paths, correlated `jsonb_agg(DISTINCT jsonb_build_object(…))`
subqueries for `jsonAgg`, `count(*)::int` subqueries for `count`, and
parameterized `where` clauses.

## Layout

- `src/columns/` — column types and pipeable column properties
- `src/table.ts` — the `Table(name, fields)` class factory + introspection
- `src/relation.ts` — relation classes (`oneToOne`, `oneToMany`, …)
- `src/query.ts` — query context, pipe steps, and the type-level machinery
  that computes result shapes from selections
- `src/compile.ts` — the `Compiler` interface + Postgres compiler
- `src/hydrate.ts` — `hydrateRows`: flat rows → nested objects
- `examples/demo.ts` — runnable end-to-end demo (`pnpm demo`)
- `test/types.test-d.ts` — compile-time tests of result types and
  validation errors
- `playground/` — old experiments, kept for reference
