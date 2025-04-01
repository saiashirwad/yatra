# yatra

A playground for exploring ideas for a new, type-safe ORM for typescript. Currently designed only with Postgres in mind

## Query builder ideas

```typescript
class Book extends Table(
  "book",
  {
    id: pipe(uuid(), primaryKey),
    name: pipe(string()),
    createdAt: pipe(date(), defaultValue(new Date())),
    updatedAt: pipe(date(), defaultValue(new Date())),
    authorId: string(),
    description: pipe(string(), defaultValue("what"), nullable),
    price: pipe(number(), nullable),
  },
) {
  get author() {
    return oneToOne(
      () => Book, () => Author,
      "book.authorId", "author.id",
    );
  }

class Author extends Table(
  "author",
  {
    id: pipe(uuid(), primaryKey),
    name: pipe(string()),
    description: pipe(string(), nullable),
    createdAt: pipe(date(), defaultValue(new Date())),
    updatedAt: pipe(date(), defaultValue(new Date())),
  },
) {
  get books() {
    return oneToMany(
      () => Author, () => Book,
      "author.id", "book.authorId",
    );
  }
}


const authorWithBooks = pipe(
  Author,
  query,
  select([
    "id",
    "name",
    {
      "books": [
        "id",
        "name",
        "authorId",
        {
          "tags": ["id", "name"],
        },
      ],
    },
  ]),
);


{
  selection: [{
    table: 'author',
    fields: ['id', 'name']
  }, {
    table: 'book',
    fields: ['id', 'name', 'authorId', ...]
  }],
  joins: [{
    type: 'auto',
    source: "author",
    target: 'book',
  }]
}
```
