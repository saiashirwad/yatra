import type { AggData, NodeData } from "./ref.ts"
import type { Relation } from "./relation.ts"

// The compiler-composition contract (docs/compiler-composition.md):
// node *kinds* are core structure; node *ops* are open string tags.
// An op ships as a pair of facets — `sql` (emit text) and `eval`
// (in-memory value) — bundled into packs. Backends dispatch on op
// through a registry built from packs; core never switches on "eq".

/** A correlated sub-select (exists / aggregations). Handlers render
 * through it instead of capturing aliases — a handler that captured
 * the outer scope would break inside a subquery. */
export interface SqlScope {
  /** the sub-scope's table alias (for naming wrapper subqueries) */
  readonly name: string
  /** FROM clause of the sub-select, joins included */
  readonly from: string
  /** predicate tying the sub-scope to the enclosing scope */
  readonly correlation: string
  /** render a node inside the sub-scope */
  value(node: NodeData): string
  pred(node: NodeData): string
}

/** Emit services a SQL op handler renders through. */
export interface SqlCtx {
  /** col → qualified name, expr → dispatch, lit → parameter */
  value(node: NodeData): string
  pred(node: NodeData): string
  /** force a placeholder for a raw value */
  param(value: unknown): string
  quote(ident: string): string
  /** open a correlated sub-scope over a relation; `nodes` are the
   * sub-scope's own nodes (they decide its joins) */
  scope(
    relation: Relation<any, any>,
    key: string,
    parentChain: readonly string[],
    nodes: readonly NodeData[]
  ): SqlScope
}

/** The in-memory counterpart of {@link SqlScope}. */
export interface EvalScope {
  /** destination rows matching the current row */
  matches(): Record<string, unknown>[]
  /** evaluate a predicate with `row` as the scope's root */
  pred(
    row: Record<string, unknown>,
    node: NodeData
  ): boolean | null
  /** expand joins over the matches and project the spec's items,
   * honoring its where/order/limit — the interpreter's jsonb_agg */
  collect(spec: AggData): Record<string, unknown>[]
}

/** Eval services an in-memory op handler computes through. */
export interface EvalCtx {
  value(node: NodeData): unknown
  /** three-valued: comparisons over null are null, not false */
  pred(node: NodeData): boolean | null
  scope(
    relation: Relation<any, any>,
    parentChain: readonly string[]
  ): EvalScope
}

export interface PredFacets {
  readonly sql?: (
    args: readonly NodeData[],
    c: SqlCtx
  ) => string
  readonly eval?: (
    args: readonly NodeData[],
    c: EvalCtx
  ) => boolean | null
}
export interface ExprFacets {
  readonly sql?: (
    args: readonly NodeData[],
    c: SqlCtx
  ) => string
  readonly eval?: (
    args: readonly NodeData[],
    c: EvalCtx
  ) => unknown
}
export interface AggFacets {
  readonly sql?: (spec: AggData, c: SqlCtx) => string
  readonly eval?: (spec: AggData, c: EvalCtx) => unknown
}

/**
 * A named bundle of op handlers, grouped by node kind. Builders (the
 * functions that construct IR, `eq` and friends) stay plain exports —
 * a pack only carries interpretation.
 */
export interface OpPack {
  readonly name: string
  readonly pred?: Record<string, PredFacets>
  readonly expr?: Record<string, ExprFacets>
  readonly agg?: Record<string, AggFacets>
}

export interface Registry {
  readonly pred: Record<string, PredFacets>
  readonly expr: Record<string, ExprFacets>
  readonly agg: Record<string, AggFacets>
}

const KINDS = ["pred", "expr", "agg"] as const

/**
 * Validate a `lit` node that must hold a non-negative integer
 * (limit/offset, in statements and sub-shapes). Backends call this
 * instead of trusting the builder.
 */
export function litBound(
  node: NodeData | undefined,
  what: string
): number | undefined {
  if (node === undefined) return undefined
  if (node.kind !== "lit") {
    throw new Error(`${what} must be a literal`)
  }
  const v = node.value
  if (
    typeof v !== "number" ||
    !Number.isInteger(v) ||
    v < 0
  ) {
    throw new Error(
      `${what} must be a non-negative integer`
    )
  }
  return v
}

/**
 * Merge packs into one registry. A duplicate op throws — silent
 * last-wins would make pack ordering a footgun. Replacing an op on
 * purpose (a dialect lowering, say) goes through `overrides`.
 */
export function buildRegistry(
  packs: readonly OpPack[],
  overrides: readonly OpPack[] = []
): Registry {
  const registry = {
    pred: {} as Record<string, PredFacets>,
    expr: {} as Record<string, ExprFacets>,
    agg: {} as Record<string, AggFacets>
  }
  const add = (pack: OpPack, replace: boolean) => {
    for (const kind of KINDS) {
      for (const [op, facets] of Object.entries(
        pack[kind] ?? {}
      )) {
        if (!replace && op in registry[kind]) {
          throw new Error(
            `Pack '${pack.name}' redefines ${kind} op '${op}' — pass it in 'overrides' to replace it on purpose`
          )
        }
        registry[kind][op] = facets
      }
    }
  }
  for (const pack of packs) add(pack, false)
  for (const pack of overrides) add(pack, true)
  return registry
}
