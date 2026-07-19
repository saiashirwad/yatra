# yatra

**Work in progress.** TypeScript ORM that leans hard on types and
pipe composition. Postgres-flavored for now.

```sh
pnpm install
pnpm demo        # runs queries against in-memory Postgres (PGlite)
pnpm test        # real-DB tests via PGlite
pnpm check       # format + lint + typecheck (includes compile-time type tests)
```

## Layout

pnpm workspace, two packages:

- `packages/yatra` — the core: tables, columns, relations, the ref
  IR, query ops, the postgres compiler, hydration, and the typed
  `run`/`runOne` executors. Zero dependencies.
- `packages/yatra-pglite` — `pgliteExecutor(db)` adapter plus the
  demo and the real-DB test suite.

## Taste

```typescript
class Author extends Table("author", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  description: pipe(string, nullable)
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

const q = pipe(
  Author,
  query,
  select(t => [
    t.id,
    t.name,
    t.books.name,
    jsonAgg(t.books, b => [b.id, b.name])
  ]),
  where(t => ilike(t.name, "%rowling%")),
  hydrate
)

type Rows = Result<typeof q>
const { sql, params } = toSQL(q)
```
