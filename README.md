# yatra

**Work in progress.** TypeScript ORM that leans hard on types and
pipe composition. Postgres-flavored for now.

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
    "books.name",
    jsonAgg("books", ["id", "name"])
  ),
  where("name", "ilike", "%rowling%"),
  hydrate
)

type Rows = Result<typeof q>
const { sql, params } = toSQL(q)
```
