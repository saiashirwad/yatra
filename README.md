# yatra

**Work in progress.** An experiment in building an extremely type-safe,
extremely composable ORM for TypeScript. Postgres-flavored for now.


```sh
pnpm install
pnpm demo        # node examples/demo.ts
pnpm typecheck   # tsc --noEmit (includes compile-time type tests)
```

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
  select(
    "id",
    "name",
    "books.name", // autocompletes as you type
    jsonAgg("books", ["id", "name"]) // composable blocks
  ),
  where("name", "ilike", "%rowling%"),
  hydrate
)

type Rows = Result<typeof q> // fully typed nested rows
const { sql, params } = toSQL(q) // any backend can plug in here
```

