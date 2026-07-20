# Compiler composition

Named operators (`eq`, `lt`, `ilike`, …) and dialect SQL are not long-term core. Core keeps the IR, statement steps, and a way to assemble a compiler from handlers. Dialects and op packs you own supply the vocabulary and the emit rules.

## Idea

1. Query building already treats ops as opaque data. `where` only needs a `PredRef`; it does not know `eq`.
2. Node **kinds** are fixed structure (`col`, `pred`, `expr`, `as`, `agg`, `order`, `rel`). Node **ops** are open string tags (`"eq"`, `"lt"`, `"ilike"`).
3. An op is a pair: a **builder** that constructs IR, and a **handler** that interprets it (SQL string, or in-memory eval).
4. Core provides planning (join tree from chains) and a compiler shell that dispatches on `op` via a registry. It does not switch on `"eq"`.
5. Packages compose handlers into a compiler. Users can add their own ops the same way.

## Core vs packages

| Lives in core                                | Lives outside core                            |
| -------------------------------------------- | --------------------------------------------- |
| Schema, refs, `mk` / `dataOf`, accessors     | `eq`, `lt`, `lte`, `and`, `like`, …           |
| `query`, `select`, `where`, `orderBy`, …     | Postgres-only ops (`ilike`, `jsonb_agg` emit) |
| Statement shape (`as`, `asc` / `desc`)       | Dialect quote / param style (`$1` vs `?`)     |
| Plan from context (chains → join tree), scope services | Full SQL (or other) emission for each op      |
| `Compiler` contract, merge/register handlers | Ready-made `postgres` / `sqlite` compilers    |

`jsonAgg`, `count`, `whereExists` are relation-shaped builders; their **render** rules still belong with a dialect or relational pack, not a closed core switch.

## Today

`ops.ts` builds nodes with open string op tags; every op argument is bare `NodeData` with raw values wrapped in `lit`. `plan.ts` (core) owns the shared planning kernel: `collectChains` (including the `exists` chain slice), the join tree with resolved join keys, and the result projection. `compile.ts` is a single Postgres emitter that renders a `Plan` and still hard-codes the built-in tags (`eq` → `=`, `ilike` → `ILIKE`, `jsonb_agg`, `$n` params); `yatra-memory` interprets the same `Plan` with its own op switches. `run` takes an explicit compiler (`run(exec, compiler)`, postgres default). What is missing vs the target shape: the handler registry — ops are still closed switches in each backend, not packs.

## Target shape

Builders (query side):

```ts
// owned op pack, not core
export const eq = binaryPred("eq")
export const lt = binaryPred("lt")
```

Handlers (compiler side), same pack or dialect. A handler is not one function — an op has up to three **facets**:

```ts
// plan: which chains does this node demand in the ENCLOSING scope?
//   default: walk all args (correct for every leaf op)
// emit: SQL text       eval: in-memory value
export const comparePred = {
  eq: {
    emit: (a, c) => `${c.value(a[0])} = ${c.value(a[1])}`,
    eval: (a, c) => c.equals(c.value(a[0]), c.value(a[1]))
  }
}
```

Why facets: the planner already switches on op today — `exists` changes which chains join at the current level (special-cased in `collectChains`, duplicated in yatra-memory). Scope-creating ops override `plan`; the default walks args. The `eval` facet is what makes one op pack work in both the SQL compiler and yatra-memory, so custom ops behave identically on both backends. (Named decision: the IR's evaluation semantics is SQL-92's — three-valued null logic, nulls sort last. Dialect deviations live in eval packs, not new interpreters.)

Emit handlers get a scope-aware context, not a root parameter (a handler that captures the outer root breaks the moment it renders inside a subquery):

```ts
interface SqlOpContext {
  value(a): string          // col → qualified name, expr → dispatch, lit → param
  pred(a): string
  param(v): string          // force a placeholder ($1)
  quote(ident): string
  scope(source): SubqueryScope  // child plan + correlation, for exists / aggs
}
```

`exists` and the aggs are the design targets for `scope`: they render in expression position but create a sub-scope (`EXISTS (SELECT 1 FROM … WHERE correlation AND …)`). Rule of thumb: **ops produce expressions; steps produce topology.** FROM-affecting features (`link`, CTEs, `materialize`) are statement-level IR the shell reads from context — not op handlers.

A pack ships builders plus the facets for every backend it supports:

```ts
interface OpPack {
  name: string
  builders?: Record<string, unknown>
  plan?: { pred?: …; expr?: … } // shared by ALL backends — chain demand is semantics
  sql?: { pred?: …; expr?: … }
  eval?: { pred?: …; expr?: … }
}
```

Assemble a dialect:

```ts
const postgres = makeCompiler({
  dialect: "postgres",
  quote,
  paramStyle: "dollar",
  packs: [corePred, coreExpr, coreAgg, pgText] // ilike, jsonb_agg emit
})

const memory = makeEvaluator({ packs: [corePred, coreExpr, coreAgg, pgText] })
// same packs; reads the plan + eval facets
```

Custom op: define builder + facets, then add the pack. Error story:

- Missing handler fails at compile/eval naming all three coordinates: `no sql handler for pred op 'ilike' (dialect 'postgres')`.
- `withOps` throws on a duplicate key; intentional replacement goes through an explicit override (silent last-wins makes pack ordering a footgun).
- A dialect that cannot express an op either ships a **lowering** (`ilike` → `lower(a) LIKE lower(b)` on SQLite) or throws a capability error with a suggested rewrite — never a silent gap.
- The select-alias convention (`flatAlias`) is core and non-overridable — hydrate depends on it. Dialects own quote + param style only.

## Layering

| Layer    | Responsibility                                  |
| -------- | ----------------------------------------------- |
| Core API | Schema, pipe steps, IR kinds, plan              |
| Op packs | Named builders + default handlers               |
| Dialect  | Quote, params, dialect ops, `makeCompiler(...)` |
| Runtime  | Execute compiled SQL / eval plan                |

Core switches on **kind**. Packages switch on **op**.

## Status

Design note. Partially implemented: the shared plan kernel (`plan.ts`), `lit` nodes with uniform args, open op tags, the projection descriptor, and the explicit-compiler `run` all landed (FIXES.md #1–#8). Still open on op, closed on kind — custom ops get emission and evaluation, but row-shape contributions (`Contribution` / `MergeAll`) stay a closed set of brands; an op that needs a new row shape touches core types. What remains: reimplement `postgres` as `makeCompiler` + packs and yatra-memory as `makeEvaluator` over the same packs, with the memory↔pglite parity suite as the regression net. Node shapes assume docs/ir-and-scopes.md.
