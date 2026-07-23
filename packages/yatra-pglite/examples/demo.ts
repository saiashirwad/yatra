import { PGlite } from "@electric-sql/pglite"
import {
  as,
  asc,
  asId,
  del,
  desc,
  hydrate,
  insert,
  limit,
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
  count,
  eq,
  gt,
  ilike,
  isNull,
  jsonAgg,
  lt
} from "yatra-ops"
import { run, runOne, toSQL } from "yatra-postgres"
import { pgliteExecutor } from "../src/index.ts"

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

// --- a real (in-memory) postgres ---
const db = new PGlite()
const exec = pgliteExecutor(db)
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
  insert into author (id, name, description) values
    ('11111111-1111-1111-1111-111111111111', 'Ursula', 'Earthsea author'),
    ('22222222-2222-2222-2222-222222222222', 'Octavia', null);
  insert into book (id, name, "authorId", price) values
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Earthsea', '11111111-1111-1111-1111-111111111111', 12.5),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Lathe of Heaven', '11111111-1111-1111-1111-111111111111', null),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Kindred', '22222222-2222-2222-2222-222222222222', 9.99);
`)
// --- composable bricks: plain functions over refs ---
// a selection fragment — works at any depth of the ref tree
const bookCard = <Chain extends readonly ChainLink[]>(
  b: Accessor<typeof Book, Chain>
) => [b.id, b.name, b.price] as const
// a predicate fragment
const pricey = <Chain extends readonly ChainLink[]>(
  b: Accessor<typeof Book, Chain>
) => gt(b.price, 10)
// a predicate that works on ANY table with a name column
const matchesName =
  (pattern: string) =>
  (t: { readonly name: ColRef<string | null, any, any> }) =>
    ilike(t.name, pattern)
// --- pinned fragments: whole pipe steps bound to one table ---
// the QueryAccessor annotation pins the table — pop the step into a
// different table's pipe and it's a compile error
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
const flat = pipe(
  Author,
  query,
  select(t => [t.id, t.name, t.books.name]),
  where(t => matchesName("%ursula%")(t)),
  orderBy(t => desc(t.books.name)),
  limit(10)
)
console.log("--- flat (sql) ---")
console.log(toSQL(flat).sql)
const flatRows = await pipe(flat, run(exec))
console.log("\n--- flat (rows) ---")
console.dir(flatRows, { depth: null })
// --- hydrated, reusing the fragment through a relation ---
const hydrated = await pipe(
  Author,
  query,
  select(t => [t.id, t.name, ...bookCard(t.books)]),
  orderBy(t => asc(t.name)),
  hydrate,
  run(exec)
)
console.log("\n--- hydrated ---")
console.dir(hydrated, { depth: null })

const composed = await pipe(
  Author,
  query,
  select(t => [t.id, t.name]),
  select(t => [t.books.id, t.books.name, t.books.price]),
  orderBy(t => asc(t.name)),
  hydrate,
  run(exec)
)

const AuthorIdAndName = pipe(
  Author,
  query,
  select(t => [t.id, t.name])
)

const _w00t = await pipe(
  AuthorIdAndName,
  where(a => lt(a.books.price, 100)),
  run(exec)
)

console.log("\n--- composed selects (flat) ---")
console.dir(composed, { depth: null })

const yeet = run(exec)

const withBooks = await pipe(
  Author,
  query,
  select(t => [
    t.id,
    t.name,
    jsonAgg(t.books, b => [b.id, b.name, b.price]),
    as(count(t.books), "bookCount")
  ]),
  orderBy(t => desc(t.name)),
  yeet
)

console.log("\n--- jsonAgg + count ---")
console.dir(withBooks, { depth: null })
// --- one row, filtered by a reusable predicate ---
const firstPricey = await pipe(
  Book,
  query,
  select(b => bookCard(b)),
  where(b => pricey(b)),
  orderBy(b => desc(b.price)),
  limit(1),
  runOne(exec)
)
console.log("\n--- runOne (first pricey book) ---")
console.dir(firstPricey, { depth: null })

// --- pinned fragments, popped straight into pipes ---
// pipe(Author, query, cheap) // ✗ compile error: cheap is pinned to Book
const cheapBooks = await pipe(
  Book,
  query,
  bookSummary,
  cheap,
  byName,
  run(exec)
)
console.log("\n--- pinned fragments (cheap books) ---")
console.dir(cheapBooks, { depth: null })
// the same steps compose into a different query shape
const firstCheap = await pipe(
  Book,
  query,
  cheap,
  byName,
  limit(1),
  runOne(exec)
)
console.log("\n--- pinned fragments (first cheap book) ---")
console.dir(firstCheap, { depth: null })

// --- mutations: same pipe, same run ---

const inserted = await pipe(
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

console.log("\n--- insert + returning ---")
console.dir(inserted, { depth: null })

const updated = await pipe(
  Book,
  update({ price: 7.5 }),
  where(b => eq(b.name, "Earthsea")),
  returning(b => [b.name, b.price]),
  run(exec)
)

console.log("\n--- update + returning ---")
console.dir(updated, { depth: null })
const deleteBook = pipe(Book, del)

await pipe(
  deleteBook,
  where(b => isNull(b.price)),
  run(exec)
)
console.log("\n--- del (priceless books removed) ---")
const remaining = await pipe(
  Book,
  query,
  select(b => [b.name]),
  orderBy(b => asc(b.name)),
  run(exec)
)
console.dir(remaining, { depth: null })
