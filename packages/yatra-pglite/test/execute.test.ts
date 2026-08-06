import { PGlite } from "@electric-sql/pglite"
import assert from "node:assert/strict"
import { before, test } from "node:test"
import {
  as,
  asc,
  asId,
  del,
  hydrate,
  insert,
  jsonb,
  limit,
  nullable,
  number,
  offset,
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
  type Compiler,
  type IdOf
} from "yatra"
import {
  count,
  eq,
  exists,
  gt,
  ilike,
  jsonAgg,
  lower,
  mul,
  not
} from "yatra-ops"
import {
  postgres,
  run,
  runOne,
  toSQL
} from "yatra-postgres"
import { pgliteExecutor } from "../src/index.ts"
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
const exec = pgliteExecutor(db)
const URSULA = "11111111-1111-1111-1111-111111111111"
const OCTAVIA = "22222222-2222-2222-2222-222222222222"
const ITALO = "33333333-3333-3333-3333-333333333333"
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
      price double precision,
      payload jsonb
    );
  `)
  await db.query(
    `insert into author (id, name, description) values
      ($1, 'Ursula', 'Earthsea author'),
      ($2, 'Octavia', null)`,
    [URSULA, OCTAVIA]
  )
  // A legal JSON value that happens to look like a col node.
  const tricky = JSON.stringify({
    kind: "col",
    chain: [],
    key: "x"
  })
  await db.query(
    `insert into book (id, name, "authorId", price, payload) values
      ($1, 'Earthsea', $3, 12.5, $4),
      ($2, 'Lathe of Heaven', $3, null, null)`,
    [
      "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      URSULA,
      tricky
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
        id: IdOf<typeof Author>
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
        id: IdOf<typeof Author>
        name: string
        books: Array<{
          id: IdOf<typeof Book>
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
        id: IdOf<typeof Author>
        books: Array<{
          id: IdOf<typeof Book>
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
test("expressions: aliased select and where on an expr", async () => {
  const rows = await pipe(
    Author,
    query,
    select(t => [t.name, as(lower(t.name), "lowerName")]),
    orderBy(t => asc(t.name)),
    run(exec)
  )
  assert.deepEqual(rows, [
    { name: "Octavia", lowerName: "octavia" },
    { name: "Ursula", lowerName: "ursula" }
  ])
  const priceyDoubled = await pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => gt(mul(b.price, 2), 20)),
    run(exec)
  )
  assert.deepEqual(priceyDoubled, [{ name: "Earthsea" }])
})
test("exists filters parents without join duplication", async () => {
  const withBooks = await pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => exists(t.books)),
    orderBy(t => asc(t.name)),
    run(exec)
  )
  // Ursula has two books but appears once
  assert.deepEqual(withBooks, [{ name: "Ursula" }])
  const withPricey = await pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => exists(t.books, b => gt(b.price, 10))),
    run(exec)
  )
  assert.deepEqual(withPricey, [{ name: "Ursula" }])
  const bookless = await pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => not(exists(t.books))),
    run(exec)
  )
  assert.deepEqual(bookless, [{ name: "Octavia" }])
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
    Equal<
      typeof row,
      { id: IdOf<typeof Author>; name: string } | null
    >
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

// --- mutations ---
test("insert with returning gives typed rows back", async () => {
  const rows = await pipe(
    Author,
    insert({
      id: asId(
        Author,
        "33333333-3333-3333-3333-333333333333"
      ),
      name: "Italo"
    }),
    returning(t => [t.id, t.name, t.description]),
    run(exec)
  )
  type _rows = Expect<
    Equal<
      typeof rows,
      Array<{
        id: IdOf<typeof Author>
        name: string
        description: string | null
      }>
    >
  >
  assert.equal(rows.length, 1)
  assert.equal(rows[0].name, "Italo")
  assert.equal(rows[0].description, null)
})
test("insert many fills missing keys with DEFAULT", async () => {
  const rows = await pipe(
    Book,
    insert([
      {
        id: asId(
          Book,
          "dddddddd-dddd-dddd-dddd-dddddddddddd"
        ),
        name: "The Dispossessed",
        authorId: URSULA,
        price: 11.0
      },
      {
        id: asId(
          Book,
          "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee"
        ),
        name: "The Left Hand of Darkness",
        authorId: URSULA
      }
    ]),
    returning(t => [t.name, t.price]),
    run(exec)
  )
  assert.equal(rows.length, 2)
  const leftHand = rows.find(
    r => r.name === "The Left Hand of Darkness"
  )!
  assert.equal(leftHand.price, null)
})
test("update with where and returning", async () => {
  const rows = await pipe(
    Book,
    update({ price: 7.5 }),
    where(t => eq(t.name, "Earthsea")),
    returning(t => [t.id, t.price]),
    run(exec)
  )
  type _rows = Expect<
    Equal<
      typeof rows,
      Array<{ id: IdOf<typeof Book>; price: number | null }>
    >
  >
  assert.equal(rows.length, 1)
  assert.equal(rows[0].price, 7.5)
})
test("del removes rows and returns nothing", async () => {
  const out = await pipe(
    Book,
    del,
    where(t => eq(t.name, "Lathe of Heaven")),
    run(exec)
  )
  type _out = Expect<Equal<typeof out, void>>
  assert.equal(out, undefined)
  const remaining = await pipe(
    Book,
    query,
    select(t => [t.name]),
    where(t => eq(t.name, "Lathe of Heaven")),
    run(exec)
  )
  assert.equal(remaining.length, 0)
})
// --- regressions ---
test("json values that look like nodes stay parameters", async () => {
  const tricky = { kind: "col", chain: [], key: "x" }
  const ctx = pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => eq(b.payload, tricky))
  )
  const { sql, params } = toSQL(ctx)
  assert.match(sql, /= \$1/)
  assert.deepEqual(params, [tricky])
  const rows = await pipe(ctx, run(exec))
  assert.deepEqual(rows, [{ name: "Earthsea" }])
})
test("selecting the same column twice yields one column", async () => {
  const rows = await pipe(
    Author,
    query,
    select(t => [t.id, t.name]),
    select(t => [t.id]),
    orderBy(t => asc(t.name)),
    run(exec)
  )
  assert.deepEqual(rows, [
    { id: ITALO, name: "Italo" },
    { id: OCTAVIA, name: "Octavia" },
    { id: URSULA, name: "Ursula" }
  ])
})
test("limit/offset are inert at build time, validated at run time", async () => {
  const badLimit = limit(-1) // no throw here
  await assert.rejects(
    pipe(
      Author,
      query,
      select(t => [t.id]),
      badLimit,
      run(exec)
    ),
    /limit must be a non-negative integer/
  )
  const badOffset = offset(-1) // no throw here
  await assert.rejects(
    pipe(
      Author,
      query,
      select(t => [t.id]),
      badOffset,
      run(exec)
    ),
    /offset must be a non-negative integer/
  )
})
test("run takes an explicit compiler", async () => {
  let calls = 0
  const spy: Compiler = {
    dialect: "postgres",
    compile(ctx) {
      calls++
      return postgres.compile(ctx)
    }
  }
  const rows = await pipe(
    Author,
    query,
    select(t => [t.name]),
    orderBy(t => asc(t.name)),
    run(exec, spy)
  )
  assert.equal(calls, 1)
  assert.deepEqual(rows, [
    { name: "Italo" },
    { name: "Octavia" },
    { name: "Ursula" }
  ])
})
test("alias collisions are diagnosed at plan time", () => {
  assert.throws(
    () =>
      toSQL(
        pipe(
          Author,
          query,
          select(t => [
            t.books.name,
            as(lower(t.name), "books__name")
          ]),
          hydrate
        )
      ),
    /duplicate result column 'books__name'/
  )
})
