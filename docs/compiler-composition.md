# Compiler composition

Named operators (`eq`, `lt`, `ilike`, …) and dialect SQL are not long-term core. Core keeps the IR, statement steps, and a way to assemble a compiler from handlers. Dialects and op packs you own supply the vocabulary and the emit rules.

## Idea

1. Query building already treats ops as opaque data. `where` only needs a `PredRef`; it does not know `eq`.
2. Node **kinds** are fixed structure (`col`, `pred`, `expr`, `as`, `agg`, `order`, `rel`). Node **ops** are open string tags (`"eq"`, `"lt"`, `"ilike"`).
3. An op is a pair: a **builder** that constructs IR, and a **handler** that interprets it (SQL string, or in-memory eval).
4. Core provides planning (join tree from chains) and a compiler shell that dispatches on `op` via a registry. It does not switch on `"eq"`.
5. Packages compose handlers into a compiler. Users can add their own ops the same way.

## Core vs packages

| Lives in core | Lives outside core |
| ------------- | ------------------ |
| Schema, refs, `mk` / `dataOf`, accessors | `eq`, `lt`, `lte`, `and`, `like`, … |
| `query`, `select`, `where`, `orderBy`, … | Postgres-only ops (`ilike`, `jsonb_agg` emit) |
| Statement shape (`as`, `asc` / `desc`) | Dialect quote / param style (`$1` vs `?`) |
| Plan from context (chains → join tree) | Full SQL (or other) emission for each op |
| `Compiler` contract, merge/register handlers | Ready-made `postgres` / `sqlite` compilers |

`jsonAgg`, `count`, `whereExists` are relation-shaped builders; their **render** rules still belong with a dialect or relational pack, not a closed core switch.

## Today

`ops.ts` builds nodes with op tags. `compile.ts` is a single Postgres emitter that hard-codes those tags (`eq` → `=`, `ilike` → `ILIKE`, `jsonb_agg`, `$n` params). `toSQL` always uses that path. `yatra-memory` reimplements the same walks and its own op switches for evaluation.

## Target shape

Builders (query side):

```ts
// owned op pack, not core
export const eq = binaryPred("eq")
export const lt = binaryPred("lt")
```

Handlers (compiler side), same pack or dialect:

```ts
export const comparePred = {
  eq: (args, c, root) =>
    `${c.renderArg(args[0], root)} = ${c.renderArg(args[1], root)}`,
  lt: (args, c, root) =>
    `${c.renderArg(args[0], root)} < ${c.renderArg(args[1], root)}`
}
```

Assemble a dialect:

```ts
const postgres = makeCompiler(
  pipe(
    { dialect: "postgres", quote, paramStyle: "dollar", pred: {}, expr: {} },
    withOps({ pred: comparePred }),
    withOps({ pred: logicPred }),
    withOps({ pred: pgTextPred }) // ilike, …
  )
)
```

Custom op: define builder + handler, then `withOps` into an existing parts object. Missing handler for a tag fails at compile with a clear error.

## Layering

| Layer | Responsibility |
| ----- | -------------- |
| Core API | Schema, pipe steps, IR kinds, plan |
| Op packs | Named builders + default handlers |
| Dialect | Quote, params, dialect ops, `makeCompiler(...)` |
| Runtime | Execute compiled SQL / eval plan |

Core switches on **kind**. Packages switch on **op**.

## Status

Design note. Not implemented. Current core still exports ops and a monolithic Postgres `compile.ts`. Direction: open `PredOp`/`op` tags, extract plan + dispatch, move named ops and SQL emit into owned packages (with a convenience re-export if needed so apps keep a short import path).
