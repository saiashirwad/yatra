import {
  mk,
  RefData,
  type LitData,
  type Mode,
  type NodeData
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
  // insert rows / update sets: node-valued
  readonly rows?: readonly Record<string, NodeData>[]
  readonly set?: readonly Assignment[]
}
