import {
  as,
  asc,
  count,
  del,
  desc,
  eq,
  gt,
  hydrate,
  ilike,
  insert,
  isNull,
  jsonAgg,
  limit,
  lt,
  nullable,
  number,
  oneToMany,
  orderBy,
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
  type ColRef,
  type QueryAccessor
} from "yatra"
import {
  runMemory,
  runOneMemory,
  type DataSet
} from "../src/index.ts"
class Book extends Table("book", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  authorId: pipe(uuid),
  price: pipe(number, nullable)
}) {}
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
// --- the "database": plain arrays, no SQL anywhere ---
const data: DataSet = {
  author: [
    {
      id: "11111111-1111-1111-1111-111111111111",
      name: "Ursula",
      description: "Earthsea author"
    },
    {
      id: "22222222-2222-2222-2222-222222222222",
      name: "Octavia",
      description: null
    }
  ],
  book: [
    {
      id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      name: "Earthsea",
      authorId: "11111111-1111-1111-1111-111111111111",
      price: 12.5
    },
    {
      id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      name: "Lathe of Heaven",
      authorId: "11111111-1111-1111-1111-111111111111",
      price: null
    },
    {
      id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
      name: "Kindred",
      authorId: "22222222-2222-2222-2222-222222222222",
      price: 9.99
    }
  ]
}
// --- composable bricks: plain functions over refs ---
const bookCard = <Chain extends readonly ChainLink[]>(
  b: Accessor<typeof Book, Chain>
) => [b.id, b.name, b.price] as const
const pricey = <Chain extends readonly ChainLink[]>(
  b: Accessor<typeof Book, Chain>
) => gt(b.price, 10)
const matchesName =
  (pattern: string) =>
  (t: { readonly name: ColRef<string | null, any, any> }) =>
    ilike(t.name, pattern)
// --- pinned fragments: whole pipe steps bound to one table ---
const bookSummary = select(
  (b: QueryAccessor<typeof Book>) => [b.id, b.name]
)
const cheap = where((b: QueryAccessor<typeof Book>) =>
  lt(b.price, 10)
)
const byName = orderBy((b: QueryAccessor<typeof Book>) =>
  asc(b.name)
)
// --- flat rows ---
const flatRows = pipe(
  Author,
  query,
  select(t => [t.id, t.name, t.books.name]),
  where(t => matchesName("%ursula%")(t)),
  orderBy(t => desc(t.books.name)),
  limit(10),
  runMemory
)(data)
console.log("--- flat (rows) ---")
console.dir(flatRows, { depth: null })
// --- hydrated, reusing the fragment through a relation ---
const hydrated = pipe(
  Author,
  query,
  select(t => [t.id, t.name, ...bookCard(t.books)]),
  orderBy(t => asc(t.name)),
  hydrate,
  runMemory
)(data)
console.log("\n--- hydrated ---")
console.dir(hydrated, { depth: null })
const withBooks = pipe(
  Author,
  query,
  select(t => [
    t.id,
    t.name,
    jsonAgg(t.books, b => [b.id, b.name, b.price]),
    as(count(t.books), "bookCount")
  ]),
  orderBy(t => desc(t.name)),
  runMemory
)(data)
console.log("\n--- jsonAgg + count ---")
console.dir(withBooks, { depth: null })
// --- one row, filtered by a reusable predicate ---
const firstPricey = pipe(
  Book,
  query,
  select(b => bookCard(b)),
  where(b => pricey(b)),
  orderBy(b => desc(b.price)),
  limit(1),
  runOneMemory
)(data)
console.log("\n--- runOneMemory (first pricey book) ---")
console.dir(firstPricey, { depth: null })
// --- pinned fragments, popped straight into pipes ---
const cheapBooks = pipe(
  Book,
  query,
  bookSummary,
  cheap,
  byName,
  runMemory
)(data)
console.log("\n--- pinned fragments (cheap books) ---")
console.dir(cheapBooks, { depth: null })
// --- mutations: same pipe, mutates the arrays in place ---
const inserted = pipe(
  Author,
  insert({
    id: "33333333-3333-3333-3333-333333333333",
    name: "Italo"
  }),
  returning(t => [t.id, t.name, t.description]),
  runMemory
)(data)
console.log("\n--- insert + returning ---")
console.dir(inserted, { depth: null })
const updated = pipe(
  Book,
  update({ price: 7.5 }),
  where(b => eq(b.name, "Earthsea")),
  returning(b => [b.name, b.price]),
  runMemory
)(data)
console.log("\n--- update + returning ---")
console.dir(updated, { depth: null })
pipe(
  Book,
  del,
  where(b => isNull(b.price)),
  runMemory
)(data)
console.log("\n--- del (priceless books removed) ---")
const remaining = pipe(
  Book,
  query,
  select(b => [b.name]),
  orderBy(b => asc(b.name)),
  runMemory
)(data)
console.dir(remaining, { depth: null })
