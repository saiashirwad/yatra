import { Effect } from "effect"
import {
  asc,
  hydrate,
  nullable,
  number,
  oneToMany,
  orderBy,
  pipe,
  primaryKey,
  query,
  select,
  string,
  Table,
  uuid
} from "yatra"
import {
  layerPglite,
  runEffect,
  runOneEffect,
  YatraExecutor
} from "../src/index.ts"
// --- schema ---
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
// --- program ---
const program = Effect.gen(function* () {
  const exec = yield* YatraExecutor
  yield* exec.query(
    `create table author (id uuid primary key, name text not null, description text)`,
    []
  )
  yield* exec.query(
    `create table book (id uuid primary key, name text not null, "authorId" uuid not null references author(id), price double precision)`,
    []
  )
  yield* exec.query(
    `insert into author (id, name, description) values
      ('11111111-1111-1111-1111-111111111111', 'Ursula', 'Earthsea author'),
      ('22222222-2222-2222-2222-222222222222', 'Octavia', null)`,
    []
  )
  yield* exec.query(
    `insert into book (id, name, "authorId", price) values
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Earthsea', '11111111-1111-1111-1111-111111111111', 12.5),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lathe of Heaven', '11111111-1111-1111-1111-111111111111', null),
      ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Kindred', '22222222-2222-2222-2222-222222222222', 9.99)`,
    []
  )
  // queries are ordinary pipe steps; runEffect turns them into Effects
  const flat = yield* pipe(
    Author,
    query,
    select(t => [t.id, t.name, t.books.name]),
    orderBy(t => asc(t.books.name)),
    runEffect
  )
  console.log("--- flat ---")
  console.dir(flat, { depth: null })
  const hydrated = yield* pipe(
    Author,
    query,
    select(t => [
      t.id,
      t.name,
      t.books.name,
      t.books.price
    ]),
    orderBy(t => asc(t.name)),
    hydrate,
    runEffect
  )
  console.log("\n--- hydrated ---")
  console.dir(hydrated, { depth: null })
  const firstPricey = yield* pipe(
    Book,
    query,
    select(b => [b.id, b.name, b.price]),
    // where(b => gt(b.price, 10)),
    orderBy(b => asc(b.price)),
    runOneEffect
  )
  console.log("\n--- runOneEffect ---")
  console.dir(firstPricey, { depth: null })
})
// in-memory PGlite; swap layerPglite for layerSqlClient + any
// @effect/sql-* driver to run against a real database
Effect.runPromise(
  program.pipe(Effect.provide(layerPglite()))
)
