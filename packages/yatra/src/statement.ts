import {
  mk,
  needData,
  RefData,
  type AggRef,
  type AliasedRef,
  type ChainLink,
  type ColRef,
  type ExprRef,
  type LitData,
  type Mode,
  type NodeData,
  type OrderRef,
  type RootOf
} from "./ref.ts"
import type { Tableish } from "./utils.ts"

// Statements are nodes (docs/ir-and-scopes.md). One StatementData with
// a real `kind` discriminant replaces the QueryContext record plus the
// X phantom — the gating rules (insert rejects where, mutations reject
// orderBy/limit) are one type constraint plus one runtime check in the
// planner, not three encodings.

export type StatementKind =
  | "select"
  | "insert"
  | "update"
  | "delete"

/**
 * A statement's source. Only tables today; a query value or `self`
 * (recursion) joins the union with explicit scopes
 * (docs/query-values-and-scopes.md).
 */
export type SourceData = {
  readonly kind: "table"
  readonly table: Tableish
}

/**
 * One assignment in an UPDATE: the value is a node, so expressions
 * (`mul(t.price, 2)`) work. `dbDefault` asks for the column default.
 */
export interface Assignment {
  readonly col: string
  readonly value: NodeData
}

export const DefaultValue = Symbol.for("Yatra/DefaultValue")
/** The database default for a column, as an update-set value. A real
 * node (builders unwrap it like any ref), nominally typed so it only
 * typechecks where a default makes sense. */
export interface DbDefault {
  readonly [RefData]: {
    readonly kind: "lit"
    readonly value: typeof DefaultValue
  }
}
export const dbDefault: DbDefault = mk({
  kind: "lit",
  value: DefaultValue
} satisfies LitData)

export interface StatementData {
  readonly kind: StatementKind
  readonly source: SourceData
  readonly mode: Mode
  readonly selection: readonly NodeData[]
  /** conjunction of boolean expressions */
  readonly where: readonly NodeData[]
  readonly order: readonly NodeData[]
  readonly limit?: NodeData
  readonly offset?: NodeData
  /** hint: prefer CTE / temp / client cache (backends may ignore) */
  readonly materialize?: boolean
  /** GROUP BY keys (docs/shapes.md) */
  readonly group: readonly NodeData[]
  /** predicates over groups */
  readonly having: readonly NodeData[]
  readonly distinct?: boolean
  /**
   * A set operation (docs/shapes.md): both sides are frozen
   * statements. order/limit/offset on this statement apply to the
   * combined result.
   */
  readonly setop?: {
    readonly op: "union" | "intersect" | "except"
    readonly left: StatementData
    readonly right: StatementData
  }
  // insert rows / update sets: node-valued
  readonly rows?: readonly Record<string, NodeData>[]
  readonly set?: readonly Assignment[]
}
// --- aliasing ---
export function as<
  V,
  A extends string,
  Chain extends readonly ChainLink[],
  Root
>(
  ref: ColRef<V, string, Chain, Root>,
  alias: A
): AliasedRef<V, A, Chain, Root>
export function as<V, A extends string, Root>(
  ref: ExprRef<V, Root>,
  alias: A
): AliasedRef<V, A, readonly [], Root>
export function as<
  V,
  K extends string,
  A extends string,
  Root
>(ref: AggRef<V, K, Root>, alias: A): AggRef<V, A, Root>
export function as(ref: unknown, alias: string): unknown {
  return mk({ kind: "as", target: needData(ref), alias })
}
/** Any ref that carries a value: a column or an expression. */
type AnyValueRef =
  | ColRef<any, any, any, any>
  | ExprRef<any, any>
// --- ordering ---
export function asc<R extends AnyValueRef>(
  ref: R
): OrderRef<RootOf<R>> {
  return mk({
    kind: "order",
    direction: "asc",
    ref: needData(ref)
  })
}
export function desc<R extends AnyValueRef>(
  ref: R
): OrderRef<RootOf<R>> {
  return mk({
    kind: "order",
    direction: "desc",
    ref: needData(ref)
  })
}
