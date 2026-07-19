import { PGlite } from "@electric-sql/pglite"
import assert from "node:assert/strict"
import { before, test } from "node:test"
import {
  as,
  asc,
  count,
  eq,
  hydrate,
  ilike,
  jsonAgg,
  nullable,
  number,
  oneToMany,
  orderBy,
  pipe,
  primaryKey,
  query,
  run,
  runOne,
  select,
  string,
  Table,
  uuid,
  where,
  type Executor
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
const db = new PGlite()
const exec: Executor = {
  query: async (sql, params) => {
    const res = await db.query(sql, params as unknown[])
    return res.rows as Record<string, unknown>[]
  }
}
const URSULA = "11111111-1111-1111-1111-111111111111"
const OCTAVIA = "22222222-2222-2222-2222-222222222222"
before(async () => {
  await db.exec(`
    create table author (
      id uuid primary key,
      name text not null,
      description text
    );
    create table book (
      id uuid primary key,
      name text not null,
      "authorId" uuid not null references author(id),
      price double precision
    );
  `)
  await db.query(
    `insert into author (id, name, description) values
      ($1, 'Ursula', 'Earthsea author'),
      ($2, 'Octavia', null)`,
    [URSULA, OCTAVIA]
  )
  await db.query(
    `insert into book (id, name, "authorId", price) values
      ($1, 'Earthsea', $3, 12.5),
      ($2, 'Lathe of Heaven', $3, null)`,
    [
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      URSULA
    ]
  )
})
test("flat query runs and stays typed", async () => {
  const rows = await pipe(
    Author,
    query,
    select(t => [t.id, t.name, t.books.name]),
    where(t => ilike(t.name, "%ursula%")),
    orderBy(t => asc(t.books.name)),
    run(exec)
  )
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
  assert.equal(rows.length, 2)
  assert.equal(rows[0].name, "Ursula")
  assert.deepEqual(
    rows.map(r => r["books.name"]),
    ["Earthsea", "Lathe of Heaven"]
  )
})
test("hydrate nests rows end-to-end", async () => {
  const rows = await pipe(
    Author,
    query,
    select(t => [t.id, t.name, t.books.id, t.books.name]),
    orderBy(t => asc(t.name)),
    hydrate,
    run(exec)
  )
  type _rows = Expect<
    Equal<
      typeof rows,
      Array<{
        id: string
        name: string
        books: Array<{
          id: string
          name: string
        }>
      }>
    >
  >
  assert.equal(rows.length, 2)
  const [octavia, ursula] = rows
  assert.equal(octavia.name, "Octavia")
  assert.deepEqual(octavia.books, [])
  assert.equal(ursula.name, "Ursula")
  assert.equal(ursula.books.length, 2)
  assert.deepEqual(ursula.books.map(b => b.name).sort(), [
    "Earthsea",
    "Lathe of Heaven"
  ])
})
test("jsonAgg and count come back as real values", async () => {
  const rows = await pipe(
    Author,
    query,
    select(t => [
      t.id,
      jsonAgg(t.books, b => [b.id, b.name, b.price]),
      as(count(t.books), "bookCount")
    ]),
    where(t => eq(t.name, "Ursula")),
    run(exec)
  )
  type _rows = Expect<
    Equal<
      typeof rows,
      Array<{
        id: string
        books: Array<{
          id: string
          name: string
          price: number | null
        }>
        bookCount: number
      }>
    >
  >
  assert.equal(rows.length, 1)
  const row = rows[0]
  assert.equal(row.bookCount, 2)
  assert.equal(row.books.length, 2)
  const earthsea = row.books.find(
    b => b.name === "Earthsea"
  )!
  assert.equal(earthsea.price, 12.5)
  const lathe = row.books.find(
    b => b.name === "Lathe of Heaven"
  )!
  assert.equal(lathe.price, null)
})
test("runOne returns one row or null", async () => {
  const row = await pipe(
    Author,
    query,
    select(t => [t.id, t.name]),
    where(t => eq(t.name, "Octavia")),
    runOne(exec)
  )
  type _row = Expect<
    Equal<typeof row, { id: string; name: string } | null>
  >
  assert.equal(row?.name, "Octavia")
  const nobody = await pipe(
    Author,
    query,
    select(t => [t.id, t.name]),
    where(t => eq(t.name, "Nobody")),
    runOne(exec)
  )
  assert.equal(nobody, null)
})
