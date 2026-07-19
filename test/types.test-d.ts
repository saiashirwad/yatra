/**
 * Compile-time tests for the query builder's result types.
 * Run with `pnpm typecheck` — there is nothing to execute here.
 */
import {
  count,
  date,
  defaultValue,
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
  (<T>() => T extends A ? 1 : 2) extends (
    <T>() => T extends B ? 1 : 2
  ) ?
    true
  : false

type Expect<T extends true> = T

// ---------------------------------------------------------------------------
// Schema (same shape as the demo)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Flat mode
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Hydrate mode — dotted paths become nested objects / arrays
// ---------------------------------------------------------------------------

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
        tags: Array<{ id: string }>
      }>
    }>
  >
>

// To-one relations hydrate into a nullable object.
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
      author: { id: string; name: string } | null
    }>
  >
>

// ---------------------------------------------------------------------------
// Composable agg blocks — reusable across queries
// ---------------------------------------------------------------------------

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
        tags: Array<{ id: string; name: string }>
      }>
      bookCount: number
    }>
  >
>

// ---------------------------------------------------------------------------
// Incremental autocomplete — the exact unions the editor offers as you type
// ---------------------------------------------------------------------------

// "d" completes to the one matching field
type _suggestField = Expect<
  Equal<ValidatePath<typeof Author, "d">, "description">
>

// "b" completes to the relation, with a trailing dot to keep going
type _suggestRelation = Expect<
  Equal<ValidatePath<typeof Author, "b">, "books.">
>

// after "books.", every field of Book plus deeper relations complete
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

// partial leaf segments complete too
type _suggestNestedLeaf = Expect<
  Equal<
    ValidatePath<typeof Author, "books.na">,
    "books.name"
  >
>

// and one level deeper
type _suggestDeep = Expect<
  Equal<
    ValidatePath<typeof Author, "books.tags.">,
    "books.tags.id" | "books.tags.name"
  >
>

// ---------------------------------------------------------------------------
// Validation — these must all fail to compile
// ---------------------------------------------------------------------------

// Unknown field
// @ts-expect-error
pipe(Author, query, select("nope"))

// Unknown relation
// @ts-expect-error
pipe(Author, query, select("magazines.id"))

// Unknown field behind a valid relation
// @ts-expect-error
pipe(Author, query, select("books.nope"))

// jsonAgg over a non-relation key
// @ts-expect-error
pipe(Author, query, select("id", jsonAgg("name", ["id"])))

// where: value type must match the column type
// @ts-expect-error
pipe(Book, query, where("price", "=", "not a number"))

// where: "in" requires an array
// @ts-expect-error
pipe(Book, query, where("id", "in", "a1"))

// where: valid usage compiles
pipe(Book, query, where("price", "=", 42))
pipe(Book, query, where("id", "in", ["a1", "a2"]))
pipe(Book, query, where("price", "is", null))
