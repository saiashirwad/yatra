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
  book: table(t => ({
    id: string(),
    bookId: string(),
    owner: s.user(t.bookId).onDelete('cascade'),
    meta: jsonObject({
      name: string()
    })
  })),
}));
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

