# Handoff — yatra, July 2026

Read this first if you're picking up the project fresh. Last state:
branch `ref-ir`, `yatra-memory` (in-memory interpreter) and
`whereExists` added, the SQL expression bug in `compile.ts` fixed,
`pnpm check` / `pnpm test` / `pnpm demo` green from repo root.

## What yatra is now

TypeScript ORM built on **pipe composition** and a **composable ref
IR**. No string paths (the old template-literal DSL was deleted),
no builder pattern. Everything is either:

1. an **inert typed node** (the IR), or
2. a **pure function over nodes** (the ops), or
3. a **pipe step** transforming an immutable `QueryContext`.

## Architecture (the load-bearing ideas)

- `packages/yatra/src/ref.ts` — the IR. Node _runtime data_
  (`ColData`, `ExprData`, `AggData`, `PredData`, ...) lives behind
  the `RefData` symbol; node _types_ (`ColRef<V, Key, Chain>`,
  `RelRef`, `ExprRef`, `AggRef`, ...) are phantom-typed interfaces.
  Also: the proxy `accessor(table)` (field access → col node,
  relation access → deeper proxy; guards `then`/symbols), the
  `Accessor<T, Chain>` mapped type (fields + relations merged), and
  the row-shape machinery (`MergeAll`/`Contribution`/`NestChain`/
  `JoinPath`).
- `src/ops.ts` — pure functions: `as`, `lower`, `mul`,
  `eq/ne/gt/gte/lt/lte/like/ilike/inArray/isNull/isNotNull`,
  `and/or/not`, `asc/desc`, `jsonAgg`, `count`, `whereExists`
  (EXISTS subquery; renders in both `compile.ts` and
  `yatra-memory`, m2m unsupported). Predicates and `asc`/`desc`
  accept expressions too (`gt(mul(b.price, 2), 20)`,
  `asc(lower(t.name))`) — `RefValue`/`AnyValueRef` widen the
  first argument from `ColRef` to `ColRef | ExprRef`.
  User-defined ops compose identically — this is the
  extensibility story.
- `src/query.ts` — `QueryContext<T, M, Items, X>` + pipe steps:
  `query`, `select(fn)`, `where(fn)`, `orderBy(fn)`, `hydrate`,
  `limit`, `offset`. `Row`/`Result` = `MergeAll<M, Items>`, or
  `TableRow<T>` (the full row) when there is no `select` — a bare
  `query` compiles to `SELECT t.*`. `select` **appends** (like
  `where`/`orderBy`): repeated calls
  concat `selection` at runtime and the `Items` tuple at the type
  level, so independent fragments pipe into one query. `X` is a
  phantom carried on `readonly x?: X` — it lets mutation contexts
  reuse the valid steps (see below). NOTE: a naked type param as an
  intersection member in a step's ctx param (e.g. `ctx: C & {...}`)
  swallows the ctx during pipe inference and starves `T` — keep
  every generic inside the interface.
- **Step gating:** query-only steps reject mutation contexts at
  the type level — `hydrate`/`orderBy`/`limit`/`offset`/
  `runOne`/`runOneEffect` exclude `AnyMutationExtra`, `where`
  excludes `InsertExtra` — via `StepGate` (an impossible
  `Record<"message", never>` brand intersected into the ctx param;
  the generics stay inside `QueryContext`, so pipe inference is
  unaffected). `compile.ts` keeps the same rules as runtime
  backstops.
- `src/mutation.ts` — insert/update/delete. Mutation contexts are
  just `QueryContext` whose `X` is `InsertExtra`/`UpdateExtra`/
  `DeleteExtra` (runtime payload lives in optional `kind`/`rows`/
  `set` members). Steps: `insert(rows)` (one or many),
  `update(set)`, `del`, `returning(fn)` (= select, gated to
  mutations). `InsertInput` makes nullable + `Default`/
  `AutoIncrement`/`Generated` fields optional; bad rows/sets error
  via `ValidInsert`/`ValidUpdate` brands on the table argument.
  No-returning result type is `void`; affected-row count would
  need an `Executor` change (skipped on purpose).
- `src/compile.ts` — postgres `Compiler`: walks nodes, builds a
  join tree from ref chains, renders SQL + params. Dialect seam is
  the `Compiler` interface. Dispatches on runtime `kind`:
  `querySql` (select) vs `mutationSql` (insert/update/delete +
  `RETURNING` from `selection`; throws on hydrate/orderBy/limit/
  offset and on insert+where).
- `src/hydrate.ts` — nests flat rows using the same selection
  nodes; an empty selection passes rows through untouched.
- `src/execute.ts` — `Executor` interface (one async `query`
  function), terminal pipe steps `run(exec)` and `runOne(exec)`.
  Types flow through: `await pipe(..., hydrate, run(pool))` →
  fully inferred `Result`. `run` returns `StatementResult`:
  `MergeAll` rows for queries and mutations with `returning`,
  `void` for mutations without.
- `packages/yatra-pglite` — `pgliteExecutor(db)` adapter, the demo
  (`examples/demo.ts`, worth reading as the API showcase), and
  real-DB tests (`test/execute.test.ts`, node:test + PGlite).
- `packages/yatra-memory` — in-memory IR interpreter, no SQL at
  all: `runMemory` / `runOneMemory` (terminal pipe steps, used
  uncalled — `pipe(..., runMemory)(data)`, so the piped query is
  reusable across datasets) and `evalQuery(ctx, data)` walk the
  `QueryContext` against plain arrays (`{ [tableName]: rows[] }`)
  and reproduce the SQL semantics (joins, three-valued null logic,
  jsonAgg, hydration via the core `hydrateRows`) in JS. Mutations
  work too and mutate the arrays in place.
- `packages/yatra-effect` — Effect v4 runner: `YatraExecutor`
  service, `QueryError` tagged error, `layerSqlClient` (any
  `@effect/sql-*` driver; in v4 SQL lives at
  `effect/unstable/sql/*`) and `layerPglite(config?)`, terminal
  steps `runEffect`/`runOneEffect` returning
  `Effect<Result, QueryError, YatraExecutor>`. Deps are
  `effect@4.0.0-beta.99` + `@effect/sql-pglite@4.0.0-beta.99`
  (v4 is still a beta line; pin in lockstep). Demo:
  `pnpm --filter yatra-effect demo`.
- Compile-time type tests: `packages/yatra/test/types.test-d.ts`
  (`Expect<Equal<...>>` + `@ts-expect-error` negative tests).
  NOTE: `@ts-expect-error` must sit directly above the line the
  error lands on — oxfmt splits `pipe(...)` calls across lines.

## Type-level gotchas learned the hard way

- **Reusable fragments must be chain-generic:** `<Chain extends
readonly ChainLink[]>(b: Accessor<typeof Book, Chain>) => ...`.
  Without it, a fragment written for the root accessor won't accept
  `t.books` (chain differs → not assignable).
- **Fragments must return tuples** (`[b.id, b.name] as const`).
  A spread array widens and `MergeAll` would silently drop those
  fields from the row type — now enforced: `RequireTuple` turns a
  non-tuple `Items` into a compile error.
- `eq`/`ne` reject `null` (`= NULL` is never true in SQL) — use
  `isNull`/`isNotNull`. `gt/gte/lt/lte/inArray` already did.
- Relation join keys must be qualified `'table.column'` strings
  (`QualifiedFieldName<S/D>`); there is no default `referencedKey`
  (the old `"id"` default rendered an `"undefined"` join column).
  `joinColumns` throws on anything unqualified as a backstop.
- **Refs are branded with their root table** (a `Root` phantom on
  `ColRef`/`ExprRef`/`AliasedRef`/`AggRef`/`RelRef`/`PredRef`/
  `OrderRef`, threaded by every op). Query callbacks receive a
  `QueryAccessor<T>` (root = the query's table), and
  `select`/`where`/`orderBy`/`returning` reject foreign-rooted
  refs. `Root` defaults to `any`, so fragments and custom ops
  stay table-agnostic; a module-level `accessor(Table)` makes
  concretely-rooted refs that only compile in that table's
  queries.
- `RefData`-brand discrimination is how invalid selections error:
  `CheckItem` maps non-selectable nodes (bare `RelRef`, unaliased
  `ExprRef`) to literal error-message strings.
- Nullability rules: flat mode + any chain → `| null`; hydrate
  mode nests via relation cardinality (to-one → `| null`, to-many
  → array).

## Known limitations / honest caveats

- `jsonAgg`/`count`/`whereExists` over many-to-many throws at
  compile time (runtime), same as before.
- No migrations/DDL yet, though column property symbols carry
  nearly everything needed (`PrimaryKey`, `References`, `Default`,
  `Check`, `Index`, ...).

## Next up (agreed direction, priority order)

Design docs for the roadmap: `docs/ir-and-scopes.md` (lit nodes,
statements as nodes, explicit scopes), `docs/shapes.md` (object
select, sub-shapes, group/having, set ops, vocabulary),
`docs/compiler-composition.md` (plan/emit/eval op facets),
`FIXES.md` (live bugs + small leaks).

1. **`lit` node + uniform op args + open op tags** (FIXES.md
   #1, #6) — cheap, kills a live JSON-value-rendered-as-column
   bug, unblocks op packs.
2. **Parity suite: yatra-memory vs yatra-pglite** — one shared
   suite over both executors asserting identical results. Must
   land before any compiler surgery, no later than the registry
   port; it is the regression net for everything below.
3. **Plan into core + handler registry** — one pure
   `plan(stmt)`; `postgres` becomes `makeCompiler` + packs with
   plan/emit/eval facets; yatra-memory becomes `makeEvaluator`
   over the same packs. Also: `run` takes an explicit backend
   (FIXES.md #4), projection descriptors decouple hydrate from
   SQL alias naming (#2).
4. **Statements as nodes** — one `StatementData` discriminant;
   deletes the `X`/`StepGate` patchwork; enables mutations v2
   (expression values in `update` sets, `mul(t.price, 2)`) and
   `materialize` hints. Affected-row count still needs an
   `Executor` change.
5. **Explicit scopes/sources** — `ScopeId` replaces the `Root`
   brand; groundwork for `link`, query values, aggs/`exists`
   over statements, recursion. The type machinery
   (`MergeAll`/`NestChain`) is the risk — grow `types.test-d.ts`
   with multi-scope cases first.
6. **Object-shape select + filtered sub-shapes** — pure surface
   desugaring (docs/shapes.md); deletes `as`/`RequireTuple`/the
   visible hydrate split from the sweet path. Plus
   `group`/`having`/`distinct` and real aggregates (today you
   cannot count a table).
7. **Query values, set ops, recursion** — mostly compiler work
   once 4–5 land.

Smaller queued fixes in FIXES.md: `limit`/`offset` as `lit`
(#5), selection dedup by path (#7), `info()` memoization (#8).
Consider DDL/diff from column metadata; `first`/`maybeOne`
variants exist as `runOne`.

## Working agreements

- Commits: short, lowercase, no ceremony (see `git log`).
- `pnpm check` (oxfmt + oxlint + `tsc --noEmit` via TS 7) and
  `pnpm test` (PGlite + yatra-memory suites) must stay green; run
  both before committing.
- Node ≥24 runs TS directly (type stripping) — no build step;
  `erasableSyntaxOnly` in tsconfig enforces this.
- Core package stays dependency-free. New capabilities = new
  workspace packages.

## NOTE

do not commit this file
