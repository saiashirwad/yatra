import {
  count,
  hydrate,
  jsonAgg,
  nullable,
  number,
  oneToMany,
  oneToOne,
  pipe,
  primaryKey,
  query,
  select,
  string,
  Table,
  uuid,
  where,
  type Result,
  type ValidatePath
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
  select(
    "id",
    "description",
    "books.name",
    "books.name as bookName"
  )
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
  select(
    "id",
    "name",
    "books.id",
    "books.name",
    "books.tags.id"
  ),
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
  select("id", "author.id", "author.name"),
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
const bookList = jsonAgg("books", [
  "id",
  "name",
  "price",
  jsonAgg("tags", ["id", "name"])
])
const withAggs = pipe(
  Author,
  query,
  select(
    "id",
    bookList,
    count("books", { as: "bookCount" })
  )
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
type _suggestField = Expect<
  Equal<ValidatePath<typeof Author, "d">, "description">
>
type _suggestRelation = Expect<
  Equal<ValidatePath<typeof Author, "b">, "books.">
>
type _suggestAfterDot = Expect<
  Equal<
    ValidatePath<typeof Author, "books.">,
    | "books.id"
    | "books.name"
    | "books.authorId"
    | "books.price"
    | "books.author."
    | "books.tags."
  >
>
type _suggestNestedLeaf = Expect<
  Equal<
    ValidatePath<typeof Author, "books.na">,
    "books.name"
  >
>
type _suggestDeep = Expect<
  Equal<
    ValidatePath<typeof Author, "books.tags.">,
    "books.tags.id" | "books.tags.name"
  >
>
// @ts-expect-error unknown field
pipe(Author, query, select("nope"))
// @ts-expect-error unknown relation
pipe(Author, query, select("magazines.id"))
// @ts-expect-error unknown field behind a valid relation
pipe(Author, query, select("books.nope"))
// @ts-expect-error jsonAgg over a non-relation key
pipe(Author, query, select("id", jsonAgg("name", ["id"])))
// @ts-expect-error where value must match the column type
pipe(Book, query, where("price", "=", "not a number"))
// @ts-expect-error "in" requires an array
pipe(Book, query, where("id", "in", "a1"))
pipe(Book, query, where("price", "=", 42))
pipe(Book, query, where("id", "in", ["a1", "a2"]))
pipe(Book, query, where("price", "is", null))
