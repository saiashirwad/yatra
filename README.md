# yatra

## goals

Define your schema like this:

```typescript
const db = schema((s) => ({
  user: table({
    id: string().primaryKey().format("uuid"),
    name: string(),
    email: string(),
    books: s.book()
  }),
  book: table((t) => ({
    id: string(),
    bookId: string(),
    owner: s.user(t.bookId).onDelete('cascade'),
    meta: json({
      name: string()
    })
  })),
}));
```

eventually, we want
```typescript
const db = pgSchema((s) => ({
  user: s.table({
    id: s.string().primaryKey().format("uuid"),
    name: s.string(),
    email: s.string(),
    books: s.book()
  }),
  book: s.table((t) => ({
    id: s.string(),
    bookId: s.string(),
    owner: s.user(t.bookId).onDelete('cascade'),
    meta: s.json((j) => ({
      name: j.string()
    }))
  })),
}));
```

even more eventually, with arktype
```typescript
const db = arkSchema({
  user: {
    id: 'string.primaryKey.uuid',
    name: 'string',
    email: 'string.email',
    books: 'book[]'
  },
  book: {
    id: 'string',
    bookId: 'string',
    owner: 'user->bookId',
    meta: {
      name: 'string'
    }
  }
}))
```

```typescript
const user = db.user.parse({
})
```

Internal representation type
```typescript
TableDef<DB, {
  id: StringField<{format: 'uuid', primaryKey: true }>
  name: StringField<{}>
  email: StringField<{}>
  books: TableDef<{
    id: StringField<{ primaryKey: true }>
    ownerId: StringField<{}>
    owner: TableRef<DB['user'], { onDelete: 'cascade' }>
    meta: JsonDef<{
      name: string
    }>
  }>
}>
```

Hover type
```typescript
Table<{
  id: string & PrimaryKey & Format<'uuid'>
  name: string
  email: string
  books: Table<{
    id: string
    ownerId: string
    owner: Ref<'user'> & OnDelete<'cascade'>
    meta: {
      name: string
    }
  }>
}>
```

Clean data type
```typescript
{
  id: string 
  name: string
  email: string
}
```
