import {
  as,
  asc,
  count,
  date,
  defaultValue,
  hydrate,
  hydrateRows,
  ilike,
  inArray,
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
  select(t => [
    t.id,
    t.name,
    as(t.books.tags.id, "tagsId")
  ]),
  where(t => ilike(t.name, "%w00t%")),
  orderBy(t => asc(t.name)),
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
  select(t => [
    t.id,
    t.name,
    t.books.id,
    t.books.name,
    t.books.tags.id
  ]),
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

const withBooks = pipe(
  Author,
  query,
  select(t => [
    t.id,
    t.name,
    jsonAgg(t.books, b => [
      b.id,
      b.name,
      b.price,
      jsonAgg(b.tags, g => [g.id, g.name])
    ]),
    as(count(t.books), "bookCount")
  ]),
  where(t => inArray(t.id, ["a1", "a2"]))
)

console.log("\n--- jsonAgg / count ---")
const compiled = toSQL(withBooks)
console.log(compiled.sql)
console.log(compiled.params)
type _Check = Result<typeof withBooks>
