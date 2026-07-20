# Branded IDs

After `run()`, result values are plain data today (`id: string`). Query **refs** know their table; **values** do not. Branded IDs keep table identity on PK/FK values so write-back cannot mix entities by accident.

## Problem

```ts
const author = await pipe(
  Author,
  query,
  select(t => [t.id, t.name]),
  runOne(exec)
)
// author.id: string

// both typecheck today — Book.id and Author.id are the same string type
pipe(
  Book,
  del,
  where(t => eq(t.id, author.id)),
  run(exec)
)
```

## Idea

- Brand **only** primary keys and foreign keys.
- PK of `Author` and FK `Book.authorId` share the same brand (`IdOf<Author>`).
- Brands are type-level only; runtime stays `string` / `number`.
- Ordinary columns (`name`, `price`) stay unbranded.

```ts
type IdOf<T, V = string> = V & { readonly [IdBrand]: T }
```

## Flow

```
PK / FK column  →  value type IdOf<table>
       ↓
ColRef.V / Result / InsertInput / UpdateInput / eq RHS
```

Nested selects brand by the table that owns the column (`t.id` → Author, `t.books.id` → Book).

## Example

```ts
const author = await pipe(
  Author,
  query,
  select(t => [t.id, t.name]),
  runOne(exec)
)
// author.id: IdOf<Author>

// ok
pipe(
  Author,
  update({ name: "Ursula" }),
  where(t => eq(t.id, author.id)),
  run(exec)
)

// error: IdOf<Author> is not IdOf<Book>
pipe(
  Book,
  del,
  where(t => eq(t.id, author.id)),
  run(exec)
)

// ok: FK expects Author id
pipe(
  Book,
  insert({
    id: asId(Book, newId()),
    authorId: author.id,
    name: "Earthsea"
  }),
  run(exec)
)
```

## Boundaries

Raw strings from HTTP, seeds, and tests are not branded. Convert at the edge:

```ts
const authorId = asId(Author, req.params.id)
```

In-app flows that pass select results into `where` / `insert` stay cast-free.

## Rules

|                   |                                                |
| ----------------- | ---------------------------------------------- |
| What gets branded | PK + FK only                                   |
| FK brand          | Target table’s id type, not the owning table’s |
| Nullability       | `IdOf<T> \| null`, not brand of nullable base  |
| Results           | Carry brands from selected PK/FK columns       |
| Writes            | Same brands on insert/update id fields         |
| Escape            | `asId(Table, raw)` at trust boundaries         |

## Status

Design note, not implemented. Today `Root` on refs protects query construction only; `MergeAll` / `InferColumn` still use bare data types for values.
