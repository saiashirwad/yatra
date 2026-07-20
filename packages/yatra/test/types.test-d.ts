import {
  as,
  autoIncrement,
  count,
  defaultValue,
  del,
  eq,
  hydrate,
  ilike,
  inArray,
  insert,
  isNull,
  jsonAgg,
  lower,
  nullable,
  number,
  oneToMany,
  oneToOne,
  pipe,
  primaryKey,
  query,
  returning,
  select,
  string,
  Table,
  update,
  uuid,
  where,
  type Accessor,
  type ChainLink,
  type MutationResult,
  type Result
} from "../src/index.ts"
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <
    T
  >() => T extends B ? 1 : 2
    ? true
    : false
type Expect<T extends true> = T
class Tag extends Table("tag", {
  id: pipe(uuid, primaryKey),
  name: pipe(string)
}) {}
class Book extends Table("book", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  authorId: string,
  price: pipe(number, nullable)
}) {
  get author() {
    return oneToOne(
      () => Book,
      () => Author,
      "book.authorId",
      "author.id"
    )
  }
  get tags() {
    return oneToMany(
      () => Book,
      () => Tag,
      "book.id",
      "tag.id"
    )
  }
}
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
const flat = pipe(
  Author,
  query,
  select(t => [
    t.id,
    t.description,
    t.books.name,
    as(t.books.name, "bookName")
  ])
)
type _flat = Expect<
  Equal<
    Result<typeof flat>,
    Array<{
      id: string
      description: string | null
      "books.name": string | null
      bookName: string | null
    }>
  >
>
const hydrated = pipe(
  Author,
  query,
  select(t => [
    t.id,
    t.name,
    t.books.id,
    t.books.name,
    t.books.tags.id
  ]),
  hydrate
)
type _hydrated = Expect<
  Equal<
    Result<typeof hydrated>,
    Array<{
      id: string
      name: string
      books: Array<{
        id: string
        name: string
        tags: Array<{
          id: string
        }>
      }>
    }>
  >
>
const toOne = pipe(
  Book,
  query,
  select(t => [t.id, t.author.id, t.author.name]),
  hydrate
)
type _toOne = Expect<
  Equal<
    Result<typeof toOne>,
    Array<{
      id: string
      author: {
        id: string
        name: string
      } | null
    }>
  >
>
const withAggs = pipe(
  Author,
  query,
  select(t => [
    t.id,
    jsonAgg(t.books, b => [
      b.id,
      b.name,
      b.price,
      jsonAgg(b.tags, g => [g.id, g.name])
    ]),
    as(count(t.books), "bookCount")
  ])
)
type _withAggs = Expect<
  Equal<
    Result<typeof withAggs>,
    Array<{
      id: string
      books: Array<{
        id: string
        name: string
        price: number | null
        tags: Array<{
          id: string
          name: string
        }>
      }>
      bookCount: number
    }>
  >
>
// select appends: each call concats onto the accumulated selection
const chained = pipe(
  Author,
  query,
  select(t => [t.id]),
  select(t => [t.name, t.books.name])
)
type _chained = Expect<
  Equal<
    Result<typeof chained>,
    Array<{
      id: string
      name: string
      "books.name": string | null
    }>
  >
>
// fragments compose: independent select steps, chain-generic fragment
const bookCard = <Chain extends readonly ChainLink[]>(
  b: Accessor<typeof Book, Chain>
) => [b.id, b.name] as const
const composed = pipe(
  Author,
  query,
  select(t => [t.id]),
  select(t => bookCard(t.books)),
  hydrate
)
type _composed = Expect<
  Equal<
    Result<typeof composed>,
    Array<{
      id: string
      books: Array<{
        id: string
        name: string
      }>
    }>
  >
>
pipe(
  Author,
  query,
  select(t => [t.id]),
  // @ts-expect-error invalid items still error in a later select
  select(t => [t.books])
)
pipe(
  Author,
  query,
  // @ts-expect-error unknown field
  select(t => [t.nope])
)
pipe(
  Author,
  query,
  // @ts-expect-error unknown relation
  select(t => [t.magazines.id])
)
pipe(
  Author,
  query,
  // @ts-expect-error unknown field behind a valid relation
  select(t => [t.books.nope])
)
pipe(
  Author,
  query,
  // @ts-expect-error jsonAgg needs a relation, not a column
  select(t => [t.id, jsonAgg(t.name, b => [b.id])])
)
pipe(
  Author,
  query,
  // @ts-expect-error a bare relation is not selectable
  select(t => [t.id, t.books])
)
pipe(
  Author,
  query,
  // @ts-expect-error expressions need an alias
  select(t => [t.id, lower(t.name)])
)
pipe(
  Book,
  query,
  // @ts-expect-error ilike only works on string columns
  where(t => ilike(t.price, "%x%"))
)
pipe(
  Book,
  query,
  // @ts-expect-error where value must match the column type
  where(t => eq(t.price, "not a number"))
)
pipe(
  Book,
  query,
  // @ts-expect-error inArray requires an array
  where(t => inArray(t.id, "a1"))
)
pipe(
  Book,
  query,
  where(t => eq(t.price, 42))
)
pipe(
  Book,
  query,
  where(t => inArray(t.id, ["a1", "a2"]))
)
pipe(
  Book,
  query,
  where(t => isNull(t.price))
)

// --- mutations ---
class Widget extends Table("widget", {
  id: pipe(number, primaryKey, autoIncrement),
  name: pipe(string),
  label: pipe(string, defaultValue("unlabeled")),
  note: pipe(string, nullable)
}) {}
// db-computed (autoIncrement, default) and nullable fields are optional
const ins = pipe(
  Widget,
  insert({ name: "a" }),
  returning(t => [t.id, t.label])
)
type _ins = Expect<
  Equal<
    MutationResult<typeof ins>,
    Array<{ id: number; label: string }>
  >
>
pipe(
  Widget,
  insert([
    { name: "a" },
    { name: "b", label: "x", note: null }
  ])
)
pipe(
  Widget,
  // @ts-expect-error insert missing a required field
  insert({ label: "x" })
)
pipe(
  Widget,
  // @ts-expect-error insert value of the wrong type
  insert({ name: 42 })
)
pipe(
  Widget,
  // @ts-expect-error insert with an unknown column
  insert({ nam: "x" })
)
const upd = pipe(
  Widget,
  update({ name: "b", note: null }),
  where(t => eq(t.id, 1)),
  returning(t => [t.id, t.name])
)
type _upd = Expect<
  Equal<
    MutationResult<typeof upd>,
    Array<{ id: number; name: string }>
  >
>
pipe(
  Widget,
  // @ts-expect-error update value of the wrong type
  update({ name: 42 })
)
pipe(
  Widget,
  // @ts-expect-error update with an unknown column
  update({ nope: 1 })
)
const delQ = pipe(
  Widget,
  del,
  where(t => eq(t.name, "x"))
)
type _del = Expect<Equal<MutationResult<typeof delQ>, void>>
const delReturning = pipe(
  Widget,
  del,
  where(t => eq(t.name, "x")),
  returning(t => [t.id])
)
type _delReturning = Expect<
  Equal<
    MutationResult<typeof delReturning>,
    Array<{ id: number }>
  >
>
pipe(
  Widget,
  del,
  // @ts-expect-error where value must match the column type
  where(t => eq(t.name, 42))
)
