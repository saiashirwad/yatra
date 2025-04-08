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

// option 1
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

// option 2
const authorWithBooks = pipe(
  Author,
  query,
  select(
    "id",
    "name",
    jsonAgg("books", [
      "id",
      "name",
      "authorId",
      jsonAgg("tags", ["id", "name"]),
    ]),
  ),
);


// with hydration
const authorWithBooks = pipe(
  Author,
  query,
  hydrate,
  select(
    "id",
    "name",
    'books.id',
    'books.name',
    'books.tags.id'
  ),
);

{
  id: string
  name: string
  books: {
    id: string
    name: string
    tags: {
      id: string
    }
  }[]
}

// without hydration
const authorWithBooks = pipe(
  Author,
  query,
  select(
    "id",
    "name",
    as('books.id', 'bookId'),
    as('books.name', 'bookName'),
    as('books.tags.id','bookTagId')
  ),
);
// without hydrate
{
  id: string
  name: string
}
```

```sql
select id, name, books.id as bookId, books.name as bookName, tags.id as books__tags__name
where ... left joins
```

```sql
SELECT
    u.user_id,
    u.username,
    u.email,
    COALESCE(
        jsonb_agg(
            json_build_object(
                'book_id', b.book_id,
                'title', b.title,
                'author', b.author,
                'published_year', b.published_year,
                'pages', ( 
                    SELECT
                        COALESCE(
                            jsonb_agg(
                                json_build_object(
                                    'page_id', p.page_id,
                                    'page_number', p.page_number,
                                    'summary', p.content_summary
                                ) ORDER BY p.page_number 
                            ) FILTER (WHERE p.page_id IS NOT NULL), 
                            '[]'::jsonb 
                        )
                    FROM
                        pages p
                    WHERE
                        p.book_id = b.book_id 
                )   
            )
            ORDER BY b.title
        ) FILTER (WHERE b.book_id IS NOT NULL), 
        '[]'::jsonb 
    ) AS books_with_pages_json
FROM
    users u
LEFT JOIN
    books b ON u.user_id = b.user_id
GROUP BY
    u.user_id, u.username, u.email
ORDER BY
    u.username;
```
