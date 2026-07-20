# Fixes

Live bugs and small leaks found while reviewing the core against the design docs. Each item names the fix; the bigger ones point at the design doc that owns it. Roughly ordered by "do first".

## 1. JSON values can be rendered as column references (live bug)

Op args are stored inconsistently: predicate args are branded ref objects, expression args are bare `NodeData` (`ops.ts`), so both interpreters "sniff" arguments (`argData` in `compile.ts:170-183` and `yatra-memory`). The two sniffers disagree, and the SQL one accepts *any object with a string `kind` field*. So `eq(t.payload, { kind: "col", chain: [], key: "x" })` — a legal value for a JSON column — renders as the column `"t"."x"` instead of a parameter. Wrong SQL, silent.

**Fix:** `lit` node kind + uniform bare-`NodeData` args everywhere (docs/ir-and-scopes.md §Idea 1–2). Cheap, mechanical, do first.

## 2. Hydrate is coupled to the SQL emitter's alias naming

`hydrateRows` (core) re-derives result column names using `flatAlias` imported from `compile.ts` — core's post-processor knows the Postgres emitter names columns `a__b__c`. yatra-memory, which never emits SQL, also round-trips through `flatAlias`-named flat rows. An execution detail of one interpreter has become a shared protocol.

**Fix:** compilation returns a projection descriptor alongside the SQL (`CompiledQuery { sql, params, projection }`); hydrate decodes from what the emitter actually emitted instead of re-deriving names. Memory builds nested results directly from the same descriptor. Alias collisions get diagnosed at plan time, not silently merged. The alias convention itself (`flatAlias`) stays in core, non-overridable — dialects own quote + param style only (docs/compiler-composition.md).

## 3. Join planning is copy-pasted per backend — and has already drifted

`ensureChain` / `collectChains` / `joinColumns` / the LEFT-JOIN tree exist near-verbatim in `compile.ts` and `yatra-memory`, including the `exists` chain-slice hack. The copies already drifted once (the `argData` strictness difference behind bug #1). A third backend copies it a third time. Separately, the m2m join-table column naming convention (`sourceKey.replace(".", "_")`) has leaked into yatra-memory's **dataset format contract** — the in-memory backend's data shape is dictated by the SQL emitter's physical naming.

**Fix:** one pure `plan(stmt) => Plan` in core (tree + resolved join keys + scopes; aliases stay out — they are a SQL physical concern). Backends become renderers/interpreters over `Plan`. Resolve m2m table/column names in the relation metadata, once, at schema definition. (docs/compiler-composition.md, docs/ir-and-scopes.md)

## 4. `run` hard-wires the Postgres compiler

`execute.ts` calls `toSQL(ctx)`, and `toSQL` is literally `postgres.compile`. The terminal edge — the one place interpretation should happen — has one interpreter wired in.

**Fix:** make the backend explicit: `run({ compiler, executor })`, or `run(exec, compiler = postgres)` for the short path.

## 5. `limit` / `offset` validate at build time and inline into SQL

Inert nodes should not throw (`query.ts` validates eagerly), and a limit is inlined into SQL text while a where-value is a `$n` param — no reason for the difference.

**Fix:** store as `lit` nodes; move validation to the compilers (they already re-check).

## 6. `PredOp` is a closed union containing `ilike`

A Postgres-only op sits inside the core IR type — the exact thing compiler-composition.md says must move out. `AggData.aggKind` (`"array" | "count"`) is a second closed op axis in everything but name.

**Fix:** open both to `string` (keep the union exported as `CorePredOp` for the built-in builders' own signatures). Part of the op-pack work (docs/ir-and-scopes.md §Idea 3).

## 7. Duplicate selection columns

Two `select` fragments contributing `t.id` produce duplicate columns at runtime (`MergeAll` hides it at the type level).

**Fix:** key the IR selection by path; repeated selects become idempotent and order-independent (docs/shapes.md §Ergonomics).

## 8. `info()` rescans the prototype chain on every access

`table.ts` walks `Reflect.ownKeys` up the prototype chain per accessor hit and per plan step. Once plan moves into core this gets hot.

**Fix:** memoize per table class. Perf, not purity.

## 9. The IR's evaluation semantics is silently SQL's

Three-valued null logic, nulls-sort-last, `ILIKE` case-folding are hard-coded into the *generic* in-memory interpreter ("postgres default for ASC"). Defensible — parity demands it — but it should be a named decision: **the IR's evaluation semantics is SQL-92's**, and dialect deviations (e.g. SQLite null ordering) belong in the eval handler packs, not in new interpreters.

**Fix:** one line in compiler-composition.md; no code change until a second dialect needs it.
