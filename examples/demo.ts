import {
  count,
  date,
  defaultValue,
  hydrate,
  hydrateRows,
  jsonAgg,
  limit,
  nullable,
  number,
  offset,
  oneToMany,
  oneToOne,
  orderBy,
  pipe,
  primaryKey,
  query,
  select,
  string,
  Table,
  toSQL,
  uuid,
  where,
  type Result
} from "../src/index.ts"
class Tag extends Table("tag", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  createdAt: pipe(date, defaultValue(new Date())),
  updatedAt: pipe(date, defaultValue(new Date()))
}) {}
class Book extends Table("book", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  createdAt: pipe(date, defaultValue(new Date())),
  updatedAt: pipe(date, defaultValue(new Date())),
  authorId: string,
  description: pipe(string, defaultValue("what"), nullable),
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
  description: pipe(string, nullable),
  createdAt: pipe(date, defaultValue(new Date())),
  updatedAt: pipe(date, defaultValue(new Date()))
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
  select("id", "name", "books.tags.id as tagsId"),
  where("name", "ilike", "%w00t%"),
  orderBy("name", "asc"),
  limit(10),
  offset(0),
  toSQL
)
console.log("--- flat ---")
console.log(flat.sql)
console.log(flat.params)
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
console.log("\n--- hydrated (sql) ---")
console.log(toSQL(hydrated).sql)
const rows = [
  {
    id: "a1",
    name: "Ursula",
    books__id: "b1",
    books__name: "Earthsea",
    books__tags__id: "t1"
  },
  {
    id: "a1",
    name: "Ursula",
    books__id: "b1",
    books__name: "Earthsea",
    books__tags__id: "t2"
  },
  {
    id: "a1",
    name: "Ursula",
    books__id: "b2",
    books__name: "Lathe of Heaven",
    books__tags__id: null
  },
  {
    id: "a2",
    name: "Octavia",
    books__id: null,
    books__name: null,
    books__tags__id: null
  }
]
const nested: Result<typeof hydrated> = hydrateRows(
  hydrated,
  rows
)
console.log("\n--- hydrated (rows) ---")
console.dir(nested, { depth: null })
const bookList = jsonAgg("books", [
  "id",
  "name",
  "price",
  jsonAgg("tags", ["id", "name"])
])
const withBooks = pipe(
  Author,
  query,
  select(
    "id",
    "name",
    bookList,
    count("books", { as: "bookCount" })
  ),
  where("id", "in", ["a1", "a2"]),
  toSQL
)
console.log("\n--- jsonAgg / count ---")
console.log(withBooks.sql)
console.log(withBooks.params)
type _Check = Result<typeof withBooks>
