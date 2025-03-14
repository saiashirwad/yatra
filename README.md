# yatra

```typescript
class Book extends Table(
  "book",
  {
    id: uuid().primaryKey(),
    authorId: string(),
    description: string().default("what"),
  },
  (fields) => ({
    author: manyToOne(fields, () => new User())
      .using("authorId")
      .references("id")
      .build(),
  }),
) {}

class User extends Table(
  "user",
  {
    id: uuid().primaryKey(),
    name: string().default("no name").unique(),
    tags: array(_enum(["hi", "there"])).nullable(),
  },
  (fields) => ({
    books: oneToMany(fields, () => new Book()).build(),
  }),
) {}

```
