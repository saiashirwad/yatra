import assert from "node:assert/strict"
import { test } from "node:test"
import {
  and,
  as,
  asc,
  count,
  del,
  desc,
  eq,
  gt,
  gte,
  hydrate,
  ilike,
  inArray,
  insert,
  isNotNull,
  isNull,
  jsonAgg,
  jsonb,
  like,
  limit,
  lower,
  lt,
  lte,
  manyToMany,
  manyToOne,
  mul,
  ne,
  not,
  nullable,
  number,
  offset,
  oneToMany,
  or,
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
  exists
} from "yatra"
import {
  evalQuery,
  runMemory,
  runOneMemory,
  type DataSet
} from "../src/index.ts"
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <
    T
  >() => T extends B ? 1 : 2
    ? true
    : false
type Expect<T extends true> = T
class Book extends Table("book", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  authorId: pipe(uuid),
  price: pipe(number, nullable),
  payload: pipe(jsonb, nullable)
}) {
  get author() {
    return manyToOne(
      () => Book,
      () => Author,
      "book.authorId",
      "author.id"
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
class Tag extends Table("tag", {
  id: pipe(string, primaryKey),
  label: pipe(string)
}) {
  get books() {
    return manyToMany(
      () => Tag,
      () => Book,
      "book_tag",
      "tag.id",
      "book.id"
    )
  }
}
const URSULA = "11111111-1111-1111-1111-111111111111"
const OCTAVIA = "22222222-2222-2222-2222-222222222222"
const EARTHSEA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const LATHE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const KINDRED = "cccccccc-cccc-cccc-cccc-cccccccccccc"
// A legal JSON value that happens to look like a col node — it must
// be treated as a value (lit), never as a column reference.
const TRICKY = { kind: "col", chain: [], key: "x" }
function seed(): DataSet {
  return {
    author: [
      {
        id: URSULA,
        name: "Ursula",
        description: "Earthsea author"
      },
      { id: OCTAVIA, name: "Octavia", description: null }
    ],
    book: [
      {
        id: EARTHSEA,
        name: "Earthsea",
        authorId: URSULA,
        price: 12.5,
        payload: TRICKY
      },
      {
        id: LATHE,
        name: "Lathe of Heaven",
        authorId: URSULA,
        price: null
      },
      {
        id: KINDRED,
        name: "Kindred",
        authorId: OCTAVIA,
        price: 9.99
      }
    ],
    tag: [
      { id: "t1", label: "fantasy" },
      { id: "t2", label: "classic" }
    ],
    book_tag: [
      { tag_id: "t1", book_id: EARTHSEA },
      { tag_id: "t1", book_id: KINDRED },
      { tag_id: "t2", book_id: EARTHSEA }
    ]
  }
}
test("flat query with join, where, orderBy — no SQL anywhere", () => {
  const rows = pipe(
    Author,
    query,
    select(t => [t.id, t.name, t.books.name]),
    where(t => ilike(t.name, "%ursula%")),
    orderBy(t => asc(t.books.name)),
    runMemory
  )(seed())
  type _rows = Expect<
    Equal<
      typeof rows,
      Array<{
        id: string
        name: string
        "books.name": string | null
      }>
    >
  >
  assert.deepEqual(rows, [
    {
      id: URSULA,
      name: "Ursula",
      "books.name": "Earthsea"
    },
    {
      id: URSULA,
      name: "Ursula",
      "books.name": "Lathe of Heaven"
    }
  ])
})
test("every predicate op works", () => {
  const names = (
    fn: Parameters<typeof where<typeof Book>>[0]
  ) =>
    pipe(
      Book,
      query,
      select(b => [b.name]),
      where(fn),
      orderBy(b => asc(b.name)),
      runMemory
    )(seed()).map(r => r.name)
  assert.deepEqual(
    names(b => eq(b.name, "Earthsea")),
    ["Earthsea"]
  )
  assert.deepEqual(
    names(b => ne(b.name, "Earthsea")),
    ["Kindred", "Lathe of Heaven"]
  )
  assert.deepEqual(
    names(b => gt(b.price, 10)),
    ["Earthsea"]
  )
  assert.deepEqual(
    names(b => gte(b.price, 9.99)),
    ["Earthsea", "Kindred"]
  )
  assert.deepEqual(
    names(b => lt(b.price, 10)),
    ["Kindred"]
  )
  assert.deepEqual(
    names(b => lte(b.price, 9.99)),
    ["Kindred"]
  )
  assert.deepEqual(
    names(b => like(b.name, "Lathe%")),
    ["Lathe of Heaven"]
  )
  assert.deepEqual(
    names(b => like(b.name, "earth%")),
    []
  )
  assert.deepEqual(
    names(b => ilike(b.name, "earth%")),
    ["Earthsea"]
  )
  assert.deepEqual(
    names(b => inArray(b.name, ["Earthsea", "Kindred"])),
    ["Earthsea", "Kindred"]
  )
  assert.deepEqual(
    names(b => isNull(b.price)),
    ["Lathe of Heaven"]
  )
  assert.deepEqual(
    names(b => isNotNull(b.price)),
    ["Earthsea", "Kindred"]
  )
  assert.deepEqual(
    names(b => and(isNotNull(b.price), gt(b.price, 10))),
    ["Earthsea"]
  )
  assert.deepEqual(
    names(b =>
      or(eq(b.name, "Earthsea"), eq(b.name, "Kindred"))
    ),
    ["Earthsea", "Kindred"]
  )
  assert.deepEqual(
    names(b => not(isNull(b.price))),
    ["Earthsea", "Kindred"]
  )
})
test("nulls are never true: gt over a null price drops the row", () => {
  const rows = pipe(
    Author,
    query,
    select(t => [t.books.name, t.books.price]),
    where(t => gt(t.books.price, 10)),
    runMemory
  )(seed())
  assert.deepEqual(rows, [
    { "books.name": "Earthsea", "books.price": 12.5 }
  ])
})
test("expressions lower and mul, with null propagation", () => {
  const rows = pipe(
    Book,
    query,
    select(b => [
      as(lower(b.name), "lowerName"),
      as(mul(b.price, 2), "doubled")
    ]),
    orderBy(b => asc(b.name)),
    runMemory
  )(seed())
  assert.deepEqual(rows, [
    { lowerName: "earthsea", doubled: 25 },
    { lowerName: "kindred", doubled: 19.98 },
    { lowerName: "lathe of heaven", doubled: null }
  ])
  const priceyDoubled = pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => gt(mul(b.price, 2), 20)),
    runMemory
  )(seed())
  assert.deepEqual(priceyDoubled, [{ name: "Earthsea" }])
})
test("empty selection returns full root rows", () => {
  const rows = pipe(
    Author,
    query,
    where(t => eq(t.name, "Octavia")),
    runMemory
  )(seed())
  assert.deepEqual(rows, [
    { id: OCTAVIA, name: "Octavia", description: null }
  ])
})
test("hydrate nests to-many and keeps empties", () => {
  const rows = pipe(
    Author,
    query,
    select(t => [t.id, t.name, t.books.id, t.books.name]),
    orderBy(t => asc(t.name)),
    hydrate,
    runMemory
  )(seed())
  type _rows = Expect<
    Equal<
      typeof rows,
      Array<{
        id: string
        name: string
        books: Array<{ id: string; name: string }>
      }>
    >
  >
  const [octavia, ursula] = rows
  assert.equal(octavia.name, "Octavia")
  assert.deepEqual(octavia.books, [
    { id: KINDRED, name: "Kindred" }
  ])
  assert.equal(ursula.books.length, 2)
  assert.deepEqual(
    ursula.books.map(b => b.name),
    ["Earthsea", "Lathe of Heaven"]
  )
})
test("hydrate nests to-one as null when the join misses", () => {
  const data = seed()
  data.book.push({
    id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
    name: "Orphan",
    authorId: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    price: 1
  })
  const rows = pipe(
    Book,
    query,
    select(b => [b.name, b.author.name]),
    where(b => eq(b.name, "Orphan")),
    hydrate,
    runMemory
  )(data)
  assert.deepEqual(rows, [{ name: "Orphan", author: null }])
})
test("jsonAgg and count, including a zero-child row", () => {
  const rows = pipe(
    Author,
    query,
    select(t => [
      t.name,
      jsonAgg(t.books, b => [b.name, b.price]),
      as(count(t.books), "bookCount")
    ]),
    orderBy(t => asc(t.name)),
    runMemory
  )(seed())
  type _rows = Expect<
    Equal<
      typeof rows,
      Array<{
        name: string
        books: Array<{ name: string; price: number | null }>
        bookCount: number
      }>
    >
  >
  assert.deepEqual(rows[0], {
    name: "Octavia",
    books: [{ name: "Kindred", price: 9.99 }],
    bookCount: 1
  })
  assert.deepEqual(rows[1], {
    name: "Ursula",
    books: [
      { name: "Earthsea", price: 12.5 },
      { name: "Lathe of Heaven", price: null }
    ],
    bookCount: 2
  })
})
test("orderBy asc puts nulls last, desc puts them first", () => {
  const prices = (dir: typeof asc | typeof desc) =>
    pipe(
      Book,
      query,
      select(b => [b.price]),
      orderBy(b => dir(b.price)),
      runMemory
    )(seed()).map(r => r.price)
  assert.deepEqual(prices(asc), [9.99, 12.5, null])
  assert.deepEqual(prices(desc), [null, 12.5, 9.99])
})
test("many-to-many joins through the join table", () => {
  const rows = pipe(
    Tag,
    query,
    select(t => [t.label, t.books.name]),
    orderBy(t => asc(t.label)),
    runMemory
  )(seed())
  assert.deepEqual(rows, [
    { label: "classic", "books.name": "Earthsea" },
    { label: "fantasy", "books.name": "Earthsea" },
    { label: "fantasy", "books.name": "Kindred" }
  ])
})
test("offset and limit slice the joined rows", () => {
  const rows = pipe(
    Book,
    query,
    select(b => [b.name]),
    orderBy(b => asc(b.name)),
    offset(1),
    limit(1),
    runMemory
  )(seed())
  assert.deepEqual(rows, [{ name: "Kindred" }])
})
test("runOneMemory returns one row or null", () => {
  const row = pipe(
    Author,
    query,
    select(t => [t.id, t.name]),
    where(t => eq(t.name, "Octavia")),
    runOneMemory
  )(seed())
  type _row = Expect<
    Equal<typeof row, { id: string; name: string } | null>
  >
  assert.equal(row?.name, "Octavia")
  const nobody = pipe(
    Author,
    query,
    select(t => [t.id, t.name]),
    where(t => eq(t.name, "Nobody")),
    runOneMemory
  )(seed())
  assert.equal(nobody, null)
})
test("exists filters parents without join duplication", () => {
  const withBooks = pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => exists(t.books)),
    orderBy(t => asc(t.name)),
    runMemory
  )(seed())
  // Ursula has two books but appears once
  assert.deepEqual(withBooks, [
    { name: "Octavia" },
    { name: "Ursula" }
  ])
  const withPricey = pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => exists(t.books, b => gt(b.price, 10))),
    runMemory
  )(seed())
  assert.deepEqual(withPricey, [{ name: "Ursula" }])
  const bookless = pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => not(exists(t.books))),
    runMemory
  )(seed())
  assert.deepEqual(bookless, [])
  const noPriceless = pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => not(exists(t.books, b => isNull(b.price)))),
    orderBy(t => asc(t.name)),
    runMemory
  )(seed())
  assert.deepEqual(noPriceless, [{ name: "Octavia" }])
})
// --- mutations ---
test("insert with returning appends to the array", () => {
  const data = seed()
  const rows = pipe(
    Author,
    insert({
      id: "33333333-3333-3333-3333-333333333333",
      name: "Italo"
    }),
    returning(t => [t.id, t.name, t.description]),
    runMemory
  )(data)
  type _rows = Expect<
    Equal<
      typeof rows,
      Array<{
        id: string
        name: string
        description: string | null
      }>
    >
  >
  assert.deepEqual(rows, [
    {
      id: "33333333-3333-3333-3333-333333333333",
      name: "Italo",
      description: null
    }
  ])
  assert.equal(data.author.length, 3)
  assert.equal(data.author[2].name, "Italo")
})
test("insert many: missing keys read back as null", () => {
  const data = seed()
  const rows = pipe(
    Book,
    insert([
      {
        id: "dddddddd-dddd-dddd-dddd-dddddddddddd",
        name: "The Dispossessed",
        authorId: URSULA,
        price: 11.0
      },
      {
        id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
        name: "The Left Hand of Darkness",
        authorId: URSULA
      }
    ]),
    returning(t => [t.name, t.price]),
    runMemory
  )(data)
  assert.equal(rows.length, 2)
  assert.equal(data.book.length, 5)
  const leftHand = rows.find(
    r => r.name === "The Left Hand of Darkness"
  )!
  assert.equal(leftHand.price, null)
})
test("update with where mutates matching rows in place", () => {
  const data = seed()
  const rows = pipe(
    Book,
    update({ price: 7.5 }),
    where(b => eq(b.name, "Earthsea")),
    returning(b => [b.id, b.price]),
    runMemory
  )(data)
  assert.deepEqual(rows, [{ id: EARTHSEA, price: 7.5 }])
  assert.equal(
    data.book.find(b => b.name === "Earthsea")!.price,
    7.5
  )
  assert.equal(
    data.book.find(b => b.name === "Kindred")!.price,
    9.99
  )
})
test("del removes matching rows and returns nothing", () => {
  const data = seed()
  const out = pipe(
    Book,
    del,
    where(b => isNull(b.price)),
    runMemory
  )(data)
  type _out = Expect<Equal<typeof out, void>>
  assert.equal(out, undefined)
  assert.deepEqual(
    data.book.map(b => b.name),
    ["Earthsea", "Kindred"]
  )
})
// --- error backstops ---
test("mutations reject hydrate at runtime", () => {
  const ctx = pipe(Book, del) as any
  assert.throws(
    () => evalQuery({ ...ctx, mode: "hydrate" }, seed()),
    /hydrate/
  )
})
test("jsonAgg over many-to-many throws", () => {
  assert.throws(
    () =>
      pipe(
        Tag,
        query,
        select(t => [jsonAgg(t.books, b => [b.name])]),
        runMemory
      )(seed()),
    /many-to-many/
  )
})
// --- FIXES.md regressions ---
test("json values that look like nodes stay values, not columns", () => {
  const rows = pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => eq(b.payload, TRICKY)),
    runMemory
  )(seed())
  assert.deepEqual(rows, [{ name: "Earthsea" }])
})
test("selecting the same column twice yields one column", () => {
  const rows = pipe(
    Author,
    query,
    select(t => [t.id, t.name]),
    select(t => [t.id]),
    orderBy(t => asc(t.name)),
    runMemory
  )(seed())
  assert.deepEqual(rows, [
    { id: OCTAVIA, name: "Octavia" },
    { id: URSULA, name: "Ursula" }
  ])
})
test("limit/offset are inert at build time, validated at run time", () => {
  const badLimit = limit(-1) // no throw here
  assert.throws(
    () =>
      pipe(
        Author,
        query,
        select(t => [t.id]),
        badLimit,
        runMemory
      )(seed()),
    /limit must be a non-negative integer/
  )
  const badOffset = offset(-1) // no throw here
  assert.throws(
    () =>
      pipe(
        Author,
        query,
        select(t => [t.id]),
        badOffset,
        runMemory
      )(seed()),
    /offset must be a non-negative integer/
  )
})
test("alias collisions are diagnosed at plan time", () => {
  assert.throws(
    () =>
      pipe(
        Author,
        query,
        select(t => [
          t.books.name,
          as(lower(t.name), "books__name")
        ]),
        hydrate,
        runMemory
      )(seed()),
    /duplicate result column 'books__name'/
  )
})
