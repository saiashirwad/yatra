# Fixes

All items done (July 2026). Kept as a record of what changed and why.

## 1. JSON values can be rendered as column references — done

`lit` node kind in `ref.ts`; builders wrap every raw value
(`builders.ts` in yatra-ops), so op
args are uniform bare `NodeData` and both `argData` sniffers are deleted.
Regression test: "json values that look like nodes stay values/parameters"
in both backend suites.

## 2. Hydrate is coupled to the SQL emitter's alias naming — done

`plan.ts` computes a projection descriptor (`projectionOf`);
`CompiledQuery` carries it and `hydrateRows` decodes from it — no more
`flatAlias` re-derivation in hydrate or yatra-memory. Duplicate result
columns throw at plan time. `flatAlias` stays in core.

## 3. Join planning is copy-pasted per backend — done

One pure `plan(ctx)` in `packages/yatra/src/plan.ts`: join tree +
resolved join keys (`PlanJoin`), chains, projection. `compile.ts`
renders SQL over it; yatra-memory interprets it. m2m join-table column
names are resolved once on `ManyToManyRelation`
(`joinSourceCol`/`joinDestCol`). Aliases stay out of the plan — the SQL
emitter derives them.

## 4. `run` hard-wires the Postgres compiler — done

Core `run(exec, compiler)` takes an explicit compiler (and `runOne`
likewise); yatra-postgres exports `run`/`runOne` wrappers that default
to the ready-made `postgres` compiler.

## 5. `limit` / `offset` validate at build time and inline into SQL — done

Stored as `lit` nodes; the steps no longer throw. Compilers validate
(non-negative integer) and emit them as bound params.

## 6. `PredOp` is a closed union containing `ilike` — done

`PredData.op` and `AggData.aggKind` are open `string`s; the built-in union
is exported as `CorePredOp` from yatra-ops' builders. Unknown ops fail with
`no sql/eval handler for ... op '<op>'` naming the backend.

## 7. Duplicate selection columns — done

`select`/`returning` dedupe by path (`selectionKey` in `ref.ts`,
`appendSelection` in `query.ts`) — repeated selects are idempotent.

## 8. `info()` rescans the prototype chain on every access — done

Memoized per table class (`WeakMap` in `table.ts`).

## 9. The IR's evaluation semantics is silently SQL's — done

Named in docs/compiler-composition.md ("the IR's evaluation semantics is
SQL-92's — three-valued null logic, nulls sort last; dialect deviations
live in eval packs"). No code change needed.
