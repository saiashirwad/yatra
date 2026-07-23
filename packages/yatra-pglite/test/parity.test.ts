import { PGlite } from "@electric-sql/pglite"
import assert from "node:assert/strict"
import { before, test } from "node:test"
import {
  accessor,
  and,
  as,
  asc,
  asId,
  avg,
  count,
  dbDefault,
  del,
  desc,
  distinct,
  eq,
  except,
  gt,
  gte,
  group,
  having,
  hydrate,
  ilike,
  inArray,
  insert,
  intersect,
  isNotNull,
  isNull,
  jsonAgg,
  jsonb,
  like,
  limit,
  lower,
  lt,
  lte,
  many,
  manyToOne,
  max,
  min,
  mul,
  ne,
  not,
  nullable,
  number,
  offset,
  one,
  oneToMany,
  or,
  orderBy,
  pipe,
  primaryKey,
  query,
  returning,
  run,
  select,
  string,
  sum,
  Table,
  toSQL,
  union,
  update,
  uuid,
  where,
  exists,
  type QueryContext
} from "yatra"
import { evalQuery, type DataSet } from "yatra-memory"
import { pgliteExecutor } from "../src/index.ts"

// One suite, two backends: every case runs against PGlite (SQL) and
// yatra-memory (IR interpreter) and must produce identical results.
// This is the regression net for compiler work — a change that alters
// semantics on one side fails here before it ships.

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

const URSULA = "11111111-1111-1111-1111-111111111111"
const OCTAVIA = "22222222-2222-2222-2222-222222222222"
const EARTHSEA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
const LATHE = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
const KINDRED = "cccccccc-cccc-cccc-cccc-cccccccccccc"
// A legal JSON value shaped like a col node — must stay a value.
const TRICKY = { kind: "col", chain: [], key: "x" }

const seed = (): DataSet => ({
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
      price: null,
      payload: null
    },
    {
      id: KINDRED,
      name: "Kindred",
      authorId: OCTAVIA,
      price: 9.99,
      payload: null
    }
  ]
})

const db = new PGlite()
const exec = pgliteExecutor(db)

async function seedPg(data: DataSet) {
  await db.exec(`delete from book; delete from author;`)
  for (const a of data.author) {
    await db.query(
      `insert into author (id, name, description) values ($1, $2, $3)`,
      [a.id, a.name, a.description]
    )
  }
  for (const b of data.book) {
    await db.query(
      `insert into book (id, name, "authorId", price, payload) values ($1, $2, $3, $4, $5)`,
      [
        b.id,
        b.name,
        b.authorId,
        b.price,
        b.payload === null
          ? null
          : JSON.stringify(b.payload)
      ]
    )
  }
}

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
  await seedPg(seed())
})

/** Run one context against both backends; results must match. */
async function bothAgree(
  ctx: QueryContext<any, any, any, any>
) {
  const sqlRows = await run(exec)(ctx)
  const memRows = evalQuery(ctx, seed())
  assert.deepEqual(memRows, sqlRows)
}

// shared query values for the set-op cases
const cheapBooks = pipe(
  Book,
  query,
  select(b => [b.name]),
  where(b => lt(b.price, 10))
)
const priceyBooks = pipe(
  Book,
  query,
  select(b => [b.name]),
  where(b => gt(b.price, 10))
)
const authorBooks = pipe(
  Author,
  query,
  select(t => [t.name, t.books.name]),
  where(t => eq(t.name, "Ursula"))
)

// --- read-only cases: built once, asserted identical ---
const queryCases: Record<
  string,
  QueryContext<any, any, any, any>
> = {
  "flat join + where + orderBy": pipe(
    Author,
    query,
    select(t => [t.id, t.name, t.books.name]),
    where(t => ilike(t.name, "%ursula%")),
    orderBy(t => asc(t.books.name))
  ),
  "predicate eq": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => eq(b.name, "Earthsea"))
  ),
  "predicate ne": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => ne(b.name, "Earthsea")),
    orderBy(b => asc(b.name))
  ),
  "predicate gt / null drops out": pipe(
    Book,
    query,
    select(b => [b.name, b.price]),
    where(b => gt(b.price, 10))
  ),
  "predicate gte": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => gte(b.price, 9.99)),
    orderBy(b => asc(b.name))
  ),
  "predicate lt": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => lt(b.price, 10))
  ),
  "predicate lte": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => lte(b.price, 9.99))
  ),
  "predicate like is case-sensitive": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => like(b.name, "earth%"))
  ),
  "predicate ilike is not": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => ilike(b.name, "earth%"))
  ),
  "predicate inArray": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => inArray(b.name, ["Earthsea", "Kindred"])),
    orderBy(b => asc(b.name))
  ),
  "predicate isNull": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => isNull(b.price))
  ),
  "predicate isNotNull": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => isNotNull(b.price)),
    orderBy(b => asc(b.name))
  ),
  "and / or / not": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b =>
      and(
        not(isNull(b.price)),
        or(gt(b.price, 10), eq(b.name, "Kindred"))
      )
    ),
    orderBy(b => asc(b.name))
  ),
  "three-valued not: null comparison stays dropped": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => not(gt(b.price, 10))),
    orderBy(b => asc(b.name))
  ),
  "expressions in select and where": pipe(
    Book,
    query,
    select(b => [
      as(lower(b.name), "lowerName"),
      as(mul(b.price, 2), "doubled")
    ]),
    where(b => not(gt(mul(b.price, 2), 1000))),
    orderBy(b => asc(b.name))
  ),
  "expression in orderBy": pipe(
    Book,
    query,
    select(b => [b.name]),
    orderBy(b => desc(lower(b.name)))
  ),
  "orderBy asc: nulls last": pipe(
    Book,
    query,
    select(b => [b.price]),
    orderBy(b => asc(b.price))
  ),
  "orderBy desc: nulls first": pipe(
    Book,
    query,
    select(b => [b.price]),
    orderBy(b => desc(b.price))
  ),
  "offset + limit": pipe(
    Book,
    query,
    select(b => [b.name]),
    orderBy(b => asc(b.name)),
    offset(1),
    limit(1)
  ),
  "hydrate nests to-many, keeps empties": pipe(
    Author,
    query,
    select(t => [t.id, t.name, t.books.id, t.books.name]),
    orderBy(t => [asc(t.name), asc(t.books.name)]),
    hydrate
  ),
  "hydrate nests to-one": pipe(
    Book,
    query,
    select(b => [b.name, b.author.name]),
    orderBy(b => asc(b.name)),
    hydrate
  ),
  "jsonAgg + count, including zero children": pipe(
    Author,
    query,
    select(t => [
      t.name,
      jsonAgg(t.books, b => [b.name, b.price]),
      as(count(t.books), "bookCount")
    ]),
    orderBy(t => asc(t.name))
  ),
  "exists bare": pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => exists(t.books)),
    orderBy(t => asc(t.name))
  ),
  "exists with predicate": pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => exists(t.books, b => gt(b.price, 10)))
  ),
  "not exists": pipe(
    Author,
    query,
    select(t => [t.name]),
    where(t => not(exists(t.books, b => isNull(b.price)))),
    orderBy(t => asc(t.name))
  ),
  "json value shaped like a node stays a value": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => eq(b.payload, TRICKY))
  ),
  "falsy entries drop out of where and orderBy": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => [false, undefined, gt(b.price, 10)]),
    orderBy(b => [null, asc(b.name)])
  ),
  "object select: plain, aliased expr, count": pipe(
    Author,
    query,
    select(t => ({
      id: t.id,
      name: t.name,
      lowerName: lower(t.name),
      bookCount: count(t.books)
    })),
    orderBy(t => asc(t.name))
  ),
  "object select: many with a sub-shape": pipe(
    Author,
    query,
    select(t => ({
      name: t.name,
      books: many(t.books, b => ({
        title: b.name,
        price: b.price
      }))
    })),
    orderBy(t => asc(t.name))
  ),
  "object select: many with where/orderBy/limit": pipe(
    Author,
    query,
    select(t => ({
      name: t.name,
      books: many(
        t.books,
        b => ({ title: b.name, price: b.price }),
        {
          where: b => isNotNull(b.price),
          orderBy: b => asc(b.price),
          limit: 1
        }
      )
    })),
    orderBy(t => asc(t.name))
  ),
  "object select: one over a to-one relation": pipe(
    Book,
    query,
    select(b => ({
      title: b.name,
      author: one(b.author, a => ({ name: a.name }))
    })),
    orderBy(b => asc(b.name))
  ),
  "group + count per group": pipe(
    Book,
    query,
    group(b => [b.authorId]),
    select(b => ({ authorId: b.authorId, n: count() })),
    orderBy(b => asc(b.authorId))
  ),
  "group + having + sum": pipe(
    Book,
    query,
    group(b => [b.authorId]),
    select(b => ({
      authorId: b.authorId,
      n: count(),
      total: sum(b.price)
    })),
    having(b => gt(count(), 1))
  ),
  "bare aggregates count the whole table": pipe(
    Book,
    query,
    select(b => ({
      n: count(),
      avgPrice: avg(b.price),
      lo: min(b.price),
      hi: max(b.price)
    }))
  ),
  "bare count over an empty match": pipe(
    Book,
    query,
    select(b => ({ n: count() })),
    where(b => eq(b.name, "Nobody"))
  ),
  "distinct collapses duplicates": pipe(
    Book,
    query,
    select(b => [b.authorId]),
    distinct,
    orderBy(b => asc(b.authorId))
  ),
  "union, ordered after the op": pipe(
    cheapBooks,
    union(priceyBooks),
    orderBy(b => asc(b.name))
  ),
  "union dedupes overlap": pipe(
    cheapBooks,
    union(
      pipe(
        Book,
        query,
        select(b => [b.name]),
        where(b => lte(b.price, 9.99))
      )
    ),
    orderBy(b => asc(b.name))
  ),
  intersect: pipe(
    cheapBooks,
    intersect(
      pipe(
        Book,
        query,
        select(b => [b.name]),
        where(b => gt(b.price, 5))
      )
    )
  ),
  except: pipe(cheapBooks, except(priceyBooks)),
  "union + hydrate the combined result": pipe(
    authorBooks,
    union(
      pipe(
        Author,
        query,
        select(t => [t.name, t.books.name]),
        where(t => eq(t.name, "Octavia"))
      )
    ),
    hydrate
  ),
  "predicates compare two refs": pipe(
    Book,
    query,
    select(b => [b.name]),
    where(b => lt(b.price, mul(b.price, 2))),
    orderBy(b => asc(b.name))
  ),
  "a query value refines with more steps": pipe(
    cheapBooks,
    where(b => gt(b.price, 5)),
    orderBy(b => desc(b.name))
  )
}

for (const [name, ctx] of Object.entries(queryCases)) {
  test(`parity: ${name}`, () => bothAgree(ctx))
}

// --- mutations: compare returning rows AND the state left behind ---
const allBooks = pipe(
  Book,
  query,
  select(b => [b.id, b.name, b.authorId, b.price]),
  orderBy(b => asc(b.name))
)
const allAuthors = pipe(
  Author,
  query,
  select(a => [a.id, a.name, a.description]),
  orderBy(a => asc(a.name))
)

async function bothMutate(
  ctx: QueryContext<any, any, any, any>
) {
  const data = seed()
  await seedPg(seed())
  const memOut = evalQuery(ctx, data)
  const sqlOut = await run(exec)(ctx)
  assert.deepEqual(memOut, sqlOut)
  assert.deepEqual(
    evalQuery(allBooks, data),
    await run(exec)(allBooks)
  )
  assert.deepEqual(
    evalQuery(allAuthors, data),
    await run(exec)(allAuthors)
  )
  await seedPg(seed())
}

test("parity: insert with returning", () =>
  bothMutate(
    pipe(
      Author,
      insert({
        id: asId(
          Author,
          "33333333-3333-3333-3333-333333333333"
        ),
        name: "Italo"
      }),
      returning(t => [t.id, t.name, t.description])
    )
  ))
test("parity: update with where and returning", () =>
  bothMutate(
    pipe(
      Book,
      update({ price: 7.5 }),
      where(b => eq(b.name, "Earthsea")),
      returning(b => [b.id, b.price])
    )
  ))
test("parity: delete returns nothing", () =>
  bothMutate(
    pipe(
      Book,
      del,
      where(b => isNull(b.price))
    )
  ))

// mutations v2: set values are nodes — expressions over the row being
// updated, or the database default
const b = accessor(Book)
test("parity: update with an expression set", () =>
  bothMutate(
    pipe(
      Book,
      update({ price: mul(b.price, 2) }),
      where(t => isNotNull(t.price)),
      returning(t => [t.name, t.price])
    )
  ))
test("parity: update to the column default", () =>
  bothMutate(
    pipe(
      Book,
      update({ price: dbDefault }),
      where(t => eq(t.name, "Earthsea")),
      returning(t => [t.name, t.price])
    )
  ))

// plan-time validation fails identically on both backends
test("parity: grouped statements reject non-key selections", () => {
  const ctx = pipe(
    Book,
    query,
    group(t => [t.authorId]),
    select(t => ({ name: t.name, n: count() }))
  )
  assert.throws(
    () => evalQuery(ctx, seed()),
    /group keys or aggregates/
  )
  assert.throws(
    () => toSQL(ctx),
    /group keys or aggregates/
  )
})
test("parity: aggregates outside a group are rejected in where", () => {
  const ctx = pipe(
    Book,
    query,
    select(t => [t.name]),
    where(() => gt(count(), 1))
  )
  assert.throws(
    () => evalQuery(ctx, seed()),
    /aggregate functions are not allowed in where/
  )
  assert.throws(
    () => toSQL(ctx),
    /aggregate functions are not allowed in where/
  )
})
