# Compiler composition

Named operators (`eq`, `lt`, `ilike`, …) and dialect SQL are not core. Core keeps the IR, statement steps, and a way to assemble a compiler from handlers. Dialects and op packs you own supply the vocabulary and the emit rules.

## Idea

1. Query building already treats ops as opaque data. `where` only needs a `PredRef`; it does not know `eq`.
2. Node **kinds** are fixed structure (`col`, `pred`, `expr`, `as`, `agg`, `order`, `rel`). Node **ops** are open string tags (`"eq"`, `"lt"`, `"ilike"`).
3. An op is a pair: a **builder** that constructs IR, and a **handler** that interprets it (SQL string, or in-memory eval).
4. Core provides planning (join tree from chains) and a compiler shell that dispatches on `op` via a registry. It does not switch on `"eq"`.
5. Packages compose handlers into a compiler. Users can add their own ops the same way.

## Core vs packages

| Lives in core                                          | Lives outside core                            |
| ------------------------------------------------------ | --------------------------------------------- |
| Schema, refs, `mk` / `dataOf`, accessors               | `eq`, `lt`, `lte`, `and`, `like`, …           |
| `query`, `select`, `where`, `orderBy`, …               | Postgres-only ops (`ilike`, `jsonb_agg` emit) |
| Statement shape (`as`, `asc` / `desc`)                 | Dialect quote / param style (`$1` vs `?`)     |
| Plan from context (chains → join tree), scope services | Full SQL (or other) emission for each op      |
| `Compiler` contract, merge/register handlers           | Ready-made `postgres` / `sqlite` compilers    |

`jsonAgg`, `count`, `whereExists` are relation-shaped builders; their **render** rules still belong with a dialect or relational pack, not a closed core switch.

## Today

Three packages. Core (`packages/yatra`) keeps the IR (`ref.ts` — nodes with open string op tags, every op argument bare `NodeData` with raw values wrapped in `lit`), the shared planning kernel (`plan.ts`: `collectChains` including the `exists` chain slice, the join tree with resolved join keys, the result projection), the facet registry (`registry.ts`), and the `makeCompiler` shell (`compile.ts`), which renders a `Plan` and dispatches every op through the registry — quote and param functions arrive with the config, nothing Postgres-specific remains. `yatra-ops` ships the built-in vocabulary: `builders.ts` (the op builders) and `packs.ts` (`corePred`, `coreExpr`, `coreAgg`, `coreAggFns`, `pgText`, `defaultPacks`). `yatra-postgres` is the dialect: `"ident"` quoting, `$n` params, the ready-made `postgres` compiler, `toSQL`, and `run` / `runOne` wrappers that default to `postgres`. Core's `run` / `runOne` take an explicit compiler — there is no core default. `yatra-memory` interprets the same `Plan` through the same packs' `eval` facets.

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

Why facets: the planner already switches on op today — `exists` changes which chains join at the current level (special-cased in `collectChains`). Scope-creating ops override `plan`; the default walks args. The `eval` facet is what makes one op pack work in both the SQL compiler and yatra-memory, so custom ops behave identically on both backends. (Named decision: the IR's evaluation semantics is SQL-92's — three-valued null logic, nulls sort last. Dialect deviations live in eval packs, not new interpreters.)

Emit handlers get a scope-aware context, not a root parameter (a handler that captures the outer root breaks the moment it renders inside a subquery):

```ts
interface SqlOpContext {
  value(a): string // col → qualified name, expr → dispatch, lit → param
  pred(a): string
  param(v): string // force a placeholder ($1)
  quote(ident): string
  scope(source): SubqueryScope // child plan + correlation, for exists / aggs
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
  quote: ident => `"${ident}"`,
  param: i => `$${i}`,
  packs: [corePred, coreExpr, coreAgg, pgText] // ilike, jsonb_agg emit
})

const memory = makeEvaluator({
  packs: [corePred, coreExpr, coreAgg, pgText]
})
// same packs; reads the plan + eval facets
```

Custom op: define builder + facets, then add the pack. Error story:

- Missing handler fails at compile/eval naming all three coordinates: `no sql handler for pred op 'ilike' (dialect 'postgres')`.
- `buildRegistry` throws on a duplicate op; intentional replacement goes through its `overrides` parameter (silent last-wins makes pack ordering a footgun).
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

Implemented. Core's `registry.ts` holds the facet contracts (`sql` /
`eval` per op, grouped by kind) and `buildRegistry` (duplicates throw;
intentional replacement goes through `overrides`). `yatra-ops` ships
the built-in vocabulary as packs — `corePred`, `coreExpr`, `coreAgg`,
`coreAggFns`, `pgText` — each op a pair of facets sharing SQL-92
semantics. `yatra-postgres` assembles the ready-made `postgres`
(`makeCompiler` with `"ident"` quoting, `$n` params, `defaultPacks`)
— plus `toSQL` and the `run` / `runOne` defaults;
yatra-memory is `makeEvaluator()` over the same `defaultPacks` and
the memory↔pglite parity suite is the regression net. Missing
handlers fail naming op, kind, and backend. The `plan` facet from
this doc is not a third facet yet — chain demand is still core's
`collectChains` (the `exists` slice lives there); it becomes a facet
when scopes land. Still closed on kind: row-shape contributions stay
a closed set of brands. Node shapes assume docs/ir-and-scopes.md.
