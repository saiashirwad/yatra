import {
  accessor,
  and,
  as,
  asc,
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
  limit,
  lower,
  ne,
  nullable,
  number,
  offset,
  oneToMany,
  oneToOne,
  orderBy,
  pipe,
  primaryKey,
  query,
  returning,
  runOne,
  select,
  string,
  Table,
  update,
  uuid,
  where,
  type Accessor,
  type ChainLink,
  type ColRef,
  type Executor,
  type StatementResult,
  type QueryAccessor,
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
    StatementResult<typeof ins>,
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
    StatementResult<typeof upd>,
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
type _del = Expect<
  Equal<StatementResult<typeof delQ>, void>
>
const delReturning = pipe(
  Widget,
  del,
  where(t => eq(t.name, "x")),
  returning(t => [t.id])
)
type _delReturning = Expect<
  Equal<
    StatementResult<typeof delReturning>,
    Array<{ id: number }>
  >
>
pipe(
  Widget,
  del,
  // @ts-expect-error where value must match the column type
  where(t => eq(t.name, 42))
)

// --- type-safety gates ---
declare const exec: Executor
declare const looseItems: readonly ColRef<
  number,
  "id",
  readonly []
>[]
// no select: the row is the full table row (SELECT t.*)
const all = pipe(Widget, query)
type _all = Expect<
  Equal<
    Result<typeof all>,
    Array<{
      id: number
      name: string
      label: string
      note: string | null
    }>
  >
>
// hydrate with no select is the same full row (no joins, no nesting)
const allHydrated = pipe(Widget, query, hydrate)
type _allHydrated = Expect<
  Equal<Result<typeof allHydrated>, Result<typeof all>>
>
pipe(
  Author,
  query,
  // @ts-expect-error eq(null) is never true in SQL — use isNull
  where(t => eq(t.description, null))
)
pipe(
  Author,
  query,
  // @ts-expect-error ne(null) is never true in SQL — use isNotNull
  where(t => ne(t.description, null))
)
pipe(
  Widget,
  query,
  // @ts-expect-error a pre-built array loses the row type
  select(() => looseItems)
)
pipe(
  Widget,
  del,
  // @ts-expect-error mutations do not support hydrate
  hydrate
)
pipe(
  Widget,
  update({ name: "b" }),
  // @ts-expect-error mutations do not support orderBy
  orderBy(t => asc(t.id))
)
pipe(
  Widget,
  del,
  // @ts-expect-error mutations do not support limit
  limit(1)
)
pipe(
  Widget,
  del,
  // @ts-expect-error mutations do not support offset
  offset(1)
)
pipe(
  Widget,
  insert({ name: "a" }),
  // @ts-expect-error insert does not take where
  where(t => eq(t.name, "x"))
)
pipe(
  Widget,
  del,
  // @ts-expect-error runOne is only for queries — use run(exec)
  runOne(exec)
)

// --- cross-query ref safety: refs are branded with their root table ---
const foreignBook = accessor(Book)
pipe(
  Author,
  query,
  // @ts-expect-error a column from another table's accessor
  select(t => [t.id, foreignBook.name])
)
pipe(
  Author,
  query,
  // @ts-expect-error an aliased column from another table
  select(t => [t.id, as(foreignBook.name, "bn")])
)
pipe(
  Author,
  query,
  // @ts-expect-error an expression over another table's column
  select(t => [t.id, as(lower(foreignBook.name), "bn")])
)
pipe(
  Author,
  query,
  select(t => [
    t.id,
    // @ts-expect-error an aggregation over another table's relation
    jsonAgg(foreignBook.tags, g => [g.id])
  ])
)
pipe(
  Author,
  query,
  // @ts-expect-error a predicate from another table
  where(() => eq(foreignBook.name, "x"))
)
pipe(
  Author,
  query,
  where(t =>
    // @ts-expect-error mixed roots inside and()
    and(ilike(t.name, "%x%"), eq(foreignBook.id, "1"))
  )
)
pipe(
  Author,
  query,
  // @ts-expect-error orderBy from another table
  orderBy(() => asc(foreignBook.name))
)
// a module-level accessor of the SAME table is fine
const sameAuthor = accessor(Author)
pipe(
  Author,
  query,
  select(t => [t.id, sameAuthor.name])
)
pipe(
  Author,
  query,
  where(() => eq(sameAuthor.name, "x"))
)

// --- reusable pinned fragments (QueryAccessor annotation) ---
const authorCard = select(
  (t: QueryAccessor<typeof Author>) => [t.id, t.name]
)
const withCard = pipe(Author, query, authorCard)
type _withCard = Expect<
  Equal<
    Result<typeof withCard>,
    Array<{ id: string; name: string }>
  >
>
pipe(
  Book,
  query,
  // @ts-expect-error a fragment pinned to Author rejects Book
  authorCard
)
const isUrsula = where((t: QueryAccessor<typeof Author>) =>
  ilike(t.name, "%u%")
)
pipe(Author, query, isUrsula)
pipe(
  Book,
  query,
  // @ts-expect-error a pinned predicate rejects the wrong table
  isUrsula
)
