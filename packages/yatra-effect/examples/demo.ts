import { Effect } from "effect"
import {
  and,
  as,
  asc,
  asId,
  count,
  del,
  desc,
  eq,
  gt,
  hydrate,
  ilike,
  inArray,
  insert,
  isNotNull,
  isNull,
  jsonAgg,
  limit,
  lower,
  lt,
  mul,
  not,
  offset,
  or,
  orderBy,
  pipe,
  query,
  returning,
  select,
  update,
  where,
  exists,
  type QueryAccessor
} from "yatra"
import {
  layerPglite,
  runEffect,
  runOneEffect,
  YatraExecutor
} from "../src/index.ts"
import { Author, Book, ids, setup } from "./setup.ts"

const show = <A, E, R>(
  label: string,
  effect: Effect.Effect<A, E, R>
) =>
  Effect.gen(function* () {
    console.log(`\n── ${label} ──`)
    console.dir(yield* effect, { depth: null })
  })

const titleAndPrice = select(
  (b: QueryAccessor<typeof Book>) => [b.name, b.price]
)
const underThirteen = where(
  (b: QueryAccessor<typeof Book>) => lt(b.price, 13)
)

const program = Effect.gen(function* () {
  yield* setup

  yield* show(
    "no select step: full table rows",
    pipe(Book, query, runEffect)
  )

  yield* show(
    "selected columns, one aliased",
    pipe(
      Book,
      query,
      select(b => [b.name, as(b.price, "cost")]),
      runEffect
    )
  )

  yield* show(
    "where, orderBy, limit",
    pipe(
      Book,
      query,
      select(b => [b.name, b.price]),
      where(b => gt(b.price, 10)),
      orderBy(b => desc(b.price)),
      limit(2),
      runEffect
    )
  )

  yield* show(
    "offset for pagination",
    pipe(
      Book,
      query,
      select(b => [b.name]),
      orderBy(b => asc(b.name)),
      limit(2),
      offset(2),
      runEffect
    )
  )

  yield* show(
    "compound predicates",
    pipe(
      Book,
      query,
      select(b => [b.name, b.price]),
      where(b =>
        and(
          ilike(b.name, "%the%"),
          or(isNull(b.price), lt(b.price, 13))
        )
      ),
      runEffect
    )
  )

  yield* show(
    "inArray and not",
    pipe(
      Book,
      query,
      select(b => [b.name]),
      where(b =>
        not(inArray(b.name, ["Kindred", "Solaris"]))
      ),
      orderBy(b => asc(b.name)),
      runEffect
    )
  )

  yield* show(
    "expressions, aliased into the row",
    pipe(
      Book,
      query,
      select(b => [
        b.name,
        as(lower(b.name), "lowered"),
        as(mul(b.price, 2), "doublePrice")
      ]),
      orderBy(b => asc(b.name)),
      limit(2),
      runEffect
    )
  )

  yield* show(
    "flat rows across a relation",
    pipe(
      Author,
      query,
      select(a => [a.name, a.books.name, a.books.price]),
      orderBy(a => [asc(a.name), asc(a.books.name)]),
      runEffect
    )
  )

  yield* show(
    "hydrated authors with their books",
    pipe(
      Author,
      query,
      select(a => [a.name, a.books.name, a.books.price]),
      orderBy(a => asc(a.name)),
      hydrate,
      runEffect
    )
  )

  yield* show(
    "hydrated books with their author",
    pipe(
      Book,
      query,
      select(b => [b.name, b.author.name]),
      orderBy(b => asc(b.name)),
      hydrate,
      runEffect
    )
  )

  yield* pipe(
    Book,
    query,
    select(b => [b.name, b.tags.label]),
    orderBy(b => asc(b.name)),
    hydrate,
    runEffect
  )

  const lol = yield* pipe(
    Author,
    query,
    select(a => [
      a.name,
      a.books.name,
      a.books.price,
      as(count(a.books), "bookCount")
    ]),
    orderBy(a => asc(a.name)),
    hydrate,
    runEffect
  )

  yield* show(
    "aggregations: jsonAgg and count",
    pipe(
      Author,
      query,
      select(a => [
        a.name,
        jsonAgg(a.books, b => [b.name, b.price]),
        as(count(a.books), "bookCount")
      ]),
      orderBy(a => asc(a.name)),
      runEffect
    )
  )

  yield* show(
    "exists: authors with a book under $11",
    pipe(
      Author,
      query,
      select(a => [a.name]),
      where(a => exists(a.books, b => lt(b.price, 11))),
      runEffect
    )
  )

  yield* show(
    "reusable fragments",
    pipe(
      Book,
      query,
      titleAndPrice,
      underThirteen,
      orderBy(b => asc(b.price)),
      runEffect
    )
  )

  yield* show(
    "runOneEffect: the priciest book",
    pipe(
      Book,
      query,
      select(b => [b.name, b.price]),
      where(b => isNotNull(b.price)),
      orderBy(b => desc(b.price)),
      runOneEffect
    )
  )

  yield* show(
    "runOneEffect: no match is null",
    pipe(
      Book,
      query,
      select(b => [b.name]),
      where(b =>
        eq(b.name, "The Making of Prince of Persia")
      ),
      runOneEffect
    )
  )

  yield* show(
    "insert with returning",
    pipe(
      Book,
      insert({
        id: asId(Book, ids.fiasco),
        name: "Fiasco",
        price: 10.5,
        authorId: asId(Author, ids.lem)
      }),
      returning(b => [b.id, b.name, b.price]),
      runEffect
    )
  )

  yield* show(
    "update with where and returning",
    pipe(
      Book,
      update({ price: 8.5 }),
      where(b => isNull(b.price)),
      returning(b => [b.name, b.price]),
      runEffect
    )
  )

  yield* show(
    "delete with returning",
    pipe(
      Book,
      del,
      where(b => eq(b.name, "Fiasco")),
      returning(b => [b.id]),
      runEffect
    )
  )

  yield* show(
    "the table after the mutations",
    pipe(
      Book,
      query,
      select(b => [b.name, b.price]),
      orderBy(b => asc(b.name)),
      runEffect
    )
  )

  yield* show(
    "failures are typed QueryErrors",
    Effect.gen(function* () {
      const exec = yield* YatraExecutor
      return yield* exec
        .query("select * from missing_table", [])
        .pipe(
          Effect.catchTag("yatra/QueryError", error =>
            Effect.succeed({
              tag: error._tag,
              sql: error.sql
            })
          )
        )
    })
  )
})

Effect.runPromise(
  program.pipe(Effect.provide(layerPglite()))
)
