# IR and scopes

The deepest planned change: make scope explicit in the IR, make statements nodes, and shrink the node vocabulary. Everything in the other design docs (link, query values, recursion, op packs) stands on this.

## Idea

1. Every value in the IR is a node. Raw JS values are wrapped in `lit` — interpreters never guess whether something is a node.
2. Node `args` hold only bare `NodeData`, never branded refs. Builders unwrap at construction; the `argData` sniffing in both backends is deleted.
3. Op tags are open strings everywhere. The closed `PredOp` union (which today contains the Postgres-only `ilike` inside the core IR type) and `AggData.aggKind` go away.
4. Statements are nodes. A select, insert, update, or delete is one `StatementData` with a real `kind` discriminant. Mutation payloads are node-valued: update sets can be expressions, `default` is a node.
5. Sources are first-class. A statement's source is a table, another statement (a query value), or `self` (recursion).
6. Scope is explicit. Columns carry a `ScopeId`, not just a chain from an implicit root. Correlation is a closure capturing a scope the inner statement does not bind; compilers resolve it upward, exactly like lexical scope.
7. Kinds consolidate. Predicates are boolean expressions. Aggs and `exists` are ordinary ops over statements. `order` stays a thin kind because position matters (only legal in `orderBy`).

## Why

- The docs' own examples mix multiple roots in one expression: `exists(cheap, c => eq(c.authorId, t.id))`, `link(cheap, (a, c) => ...)`, `recursive({ base, step })`. The current single-root `Root` brand forbids all of them at the type level. The IR cannot express three of the four design docs today.
- `QueryContext` is four statements wearing one record: IR-ish arrays, a hydrate mode, pagination scalars, plus optional `kind`/`rows`/`set` smuggled in for mutations. The gating rules (insert rejects `where`, mutations reject `orderBy`/`limit`) are encoded three times — `X` phantom + `StepGate` at the type level, and runtime throws in both interpreters. A real `kind` discriminant replaces all of it.
- Mutation v2 (expression values in update sets, `mul(t.price, 2)`) is inexpressible while `set` is `Record<string, unknown>`.

## Node shapes (sketch)

```ts
type ScopeId = string | symbol // generated per binding site

interface ColData  { kind: "col";  scope: ScopeId; chain: readonly string[]; key: string }
interface LitData  { kind: "lit";  value: unknown }
interface ExprData { kind: "expr"; op: string; args: readonly NodeData[] } // preds are boolean exprs
// as / order stay thin kinds

type SourceData =
  | { kind: "table"; table: Tableish }
  | { kind: "query"; stmt: StatementData } // a query value as source
  | { kind: "self" }                       // recursive step

interface LinkData {
  source: SourceData
  scope: ScopeId
  on?: NodeData                 // may reference outer scopes
  match: "left" | "required"
}

interface StatementData {
  kind: "select" | "insert" | "update" | "delete"
  source: SourceData
  links: readonly LinkData[]
  selection: readonly NodeData[]
  where: readonly NodeData[]    // conjunction of boolean exprs
  order: readonly NodeData[]
  limit?: NodeData              // lit
  offset?: NodeData             // lit
  hints?: readonly { kind: "materialize" }[]
  // insert rows / update sets: node-valued ({ col, value: NodeData })
}
```

## Types

- `Accessor<T, Chain, Scope>` — `Scope` replaces the `Root` brand. Steps accept refs whose scope set is a subset of the in-scope scopes (union checking, where `PredRoots` already points).
- Statement kind becomes one discriminated type parameter on the context; step gating becomes a plain constraint. `StepGate` and the `X` phantom are deleted.
- `hydrate` stops being a mode interpreters switch on; it is a declaration about result shape (and is mostly subsumed by shapes — see shapes.md).
- The risk lives in the type machinery: `MergeAll` / `NestChain` / `JoinPath` assume chains-from-one-root. The runtime change is additive (a single-root query is the one-scope case). Grow `types.test-d.ts` with multi-scope cases **before** the refactor, not after — pipe inference, chain-generic fragments, and tuple enforcement all have to be re-solved under multi-scope.

## Kinds that disappear

- **`PredData`** → `ExprData` with a boolean type; `where` accepts boolean exprs. Honest typing makes three-valued logic visible: comparison ops are `boolean | null`, which surfaces a few new type errors at `where`. Small price.
- **`AggData` + closed `aggKind`** → `count(src, on?)` and `arrayAgg(src, shape, on?)` as ordinary ops building exprs over statements. The `jsonAgg` name leaves core; the dialect handler spells `jsonb_agg`. Many-to-many aggs stop being special-cased — an agg over a statement that happens to plan a m2m link is uniformly supported, or uniformly the compiler's problem.
- **`whereExists`** → `exists(src, pred?)`, same treatment. The chain-slice special case in both planners (`collectChains`) is deleted — a subquery plans its own tree.

Node kinds drop from seven to about five: `col`, `lit`, `expr`, `as`, `order`, plus sources and statements.

## Status

Design note. Enables and is enabled by: compiler-composition.md (the registry's scope services assume these node shapes), link-and-joins.md (`link` is `LinkData`), query-values-and-scopes.md (query values are `SourceData`), shapes.md (the surface that desugars to this IR). Sequencing: `lit` + uniform args + open op tags first (done — see FIXES.md), statements-as-nodes next, explicit scopes last and largest.
