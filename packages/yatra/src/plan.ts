import { ManyToManyRelation, Relation } from "./relation.ts"
import { info, tableName } from "./table.ts"
import type { Tableish } from "./utils.ts"
import type {
  Mode,
  NodeData,
  OrderData,
  PredData,
  RelData
} from "./ref.ts"
import type { StatementData } from "./statement.ts"
import type { QueryContext } from "./query.ts"
/** Select-column alias convention. Core-owned and non-overridable —
 * hydrate decodes it; dialects own quote + param style only. */
export const flatAlias = (path: string) =>
  path.replaceAll(".", "__")
// --- join resolution (once, shared by every backend) ---
export type PlanJoin =
  | {
      readonly kind: "fk"
      readonly sourceCol: string
      readonly destCol: string
    }
  | {
      readonly kind: "m2m"
      readonly joinTable: string
      readonly sourceField: string
      readonly destinationField: string
      readonly joinSourceCol: string
      readonly joinDestCol: string
    }
function fkColumns(
  rel: {
    foreignKey: unknown
    referencedKey?: unknown
  },
  destName: string
): [sourceCol: string, destCol: string] {
  const fk = String(rel.foreignKey)
  const rk = String(rel.referencedKey)
  const [fkTable, fkCol] = fk.split(".")
  const [rkTable, rkCol] = rk.split(".")
  if (fkCol === undefined || rkCol === undefined) {
    throw new Error(
      `Join keys must be qualified ('table.column'), got foreignKey='${fk}' referencedKey='${rk}'`
    )
  }
  return fkTable === destName
    ? [rkCol, fkCol]
    : rkTable === destName
      ? [fkCol, rkCol]
      : [fkCol, rkCol]
}
/**
 * Resolve a relation's join keys once — shared by every backend.
 * Sub-scopes (exists / aggs) get their relation straight from the IR,
 * not from a plan node, so this stays exported.
 */
export function resolveJoin(
  relation: Relation<any, any>
): PlanJoin {
  if (relation instanceof ManyToManyRelation) {
    return {
      kind: "m2m",
      joinTable: relation.joinTable,
      sourceField: relation.sourceField,
      destinationField: relation.destinationField,
      joinSourceCol: relation.joinSourceCol,
      joinDestCol: relation.joinDestCol
    }
  }
  if ("foreignKey" in relation) {
    const [sourceCol, destCol] = fkColumns(
      relation,
      tableName(relation.destinationTable)
    )
    return { kind: "fk", sourceCol, destCol }
  }
  throw new Error(
    `Unsupported relation over '${tableName(relation.destinationTable)}'`
  )
}
// --- join tree (chains → nested relations; aliases stay out — they
// are a SQL physical concern, derived by the emitter) ---
export interface PlanNode {
  readonly table: Tableish
  readonly name?: string
  readonly relation?: Relation<any, any>
  readonly join?: PlanJoin
  readonly children: Map<string, PlanNode>
}
export const planRoot = (table: Tableish): PlanNode => ({
  table,
  children: new Map()
})
function ensureChain(
  root: PlanNode,
  chain: readonly string[]
) {
  let node = root
  for (const seg of chain) {
    let child = node.children.get(seg)
    if (!child) {
      const relation = info(node.table).relations[seg]
      if (!relation) {
        throw new Error(
          `'${seg}' is not a relation of table '${tableName(node.table)}'`
        )
      }
      child = {
        name: seg,
        relation,
        join: resolveJoin(relation),
        table: relation.destinationTable,
        children: new Map()
      }
      node.children.set(seg, child)
    }
    node = child
  }
}
/** Which relation chains does this node demand in the ENCLOSING scope? */
export function collectChains(
  data: NodeData,
  out: Array<readonly string[]>
) {
  switch (data.kind) {
    case "col":
      out.push(data.chain)
      break
    case "as":
      collectChains(data.target, out)
      break
    case "expr":
      for (const a of data.args) collectChains(a, out)
      break
    case "pred":
      if (data.op === "exists") {
        // the relation is the subquery's FROM, not a join — only
        // its parent chain joins at this level
        out.push(
          (data.args[0] as RelData).chain.slice(0, -1)
        )
        break
      }
      for (const a of data.args) collectChains(a, out)
      break
    case "order":
      collectChains(data.ref, out)
      break
    default:
      break
  }
}
/** A join subtree for a sub-scope (agg / exists subqueries). */
export function planScope(
  table: Tableish,
  nodes: readonly NodeData[]
): PlanNode {
  const root = planRoot(table)
  const chains: Array<readonly string[]> = []
  for (const n of nodes) collectChains(n, chains)
  for (const chain of chains) ensureChain(root, chain)
  return root
}
// --- projection: what each emitted result column decodes to ---
export interface ProjectionField {
  /** the result-column name the emitter produced */
  readonly col: string
  /** key on the (possibly nested) result object */
  readonly outKey: string
  /** nesting path below the root row ([] = root) */
  readonly chain: readonly string[]
}
function projectItem(
  data: NodeData,
  mode: Mode
): ProjectionField {
  switch (data.kind) {
    case "col": {
      const dotted = [...data.chain, data.key].join(".")
      const col =
        data.chain.length > 0
          ? mode === "hydrate"
            ? flatAlias(dotted)
            : dotted
          : data.key
      return { col, outKey: data.key, chain: data.chain }
    }
    case "as":
      return {
        col: data.alias,
        outKey: data.alias,
        chain: []
      }
    case "agg":
      return { col: data.key, outKey: data.key, chain: [] }
    default:
      throw new Error(
        `Item of kind '${data.kind}' is not selectable`
      )
  }
}
/**
 * The result-column descriptor for a selection, in selection order.
 * Emitters alias columns by `col`; hydrate decodes by it. Duplicate
 * column names are diagnosed here, at plan time.
 */
export function projectionOf(
  selection: readonly NodeData[],
  mode: Mode
): readonly ProjectionField[] {
  const fields = selection.map(item =>
    projectItem(item, mode)
  )
  const seen = new Set<string>()
  for (const f of fields) {
    if (seen.has(f.col)) {
      throw new Error(
        `Selection produces duplicate result column '${f.col}'`
      )
    }
    seen.add(f.col)
  }
  return fields
}
// --- the plan ---
/**
 * A statement plus its resolved join tree and result projection: the
 * output of planning, the input to every backend.
 */
export interface Plan extends StatementData {
  readonly where: readonly PredData[]
  readonly order: readonly OrderData[]
  readonly root: PlanNode
  readonly projection: readonly ProjectionField[]
}
/**
 * One pure `QueryContext → Plan`: validates the statement's kind rules
 * (once — the type-level `K` constraint is the front door, this is the
 * backstop), resolves the join tree and join keys, and computes the
 * result projection. Backends are renderers/interpreters over this.
 */
export function plan(
  ctx: QueryContext<any, any, any, any>
): Plan {
  if (ctx.kind !== "select") {
    if ((ctx.mode as string) !== "flat") {
      throw new Error("mutations do not support hydrate")
    }
    if (
      ctx.order.length > 0 ||
      ctx.limit !== undefined ||
      ctx.offset !== undefined
    ) {
      throw new Error(
        "mutations do not support orderBy/limit/offset"
      )
    }
    if (ctx.materialize) {
      throw new Error(
        "materialize is only meaningful on selects"
      )
    }
    if (ctx.kind === "insert" && ctx.where.length > 0) {
      throw new Error("insert does not take where")
    }
  }
  const selection = ctx.selection as readonly NodeData[]
  const where = ctx.where.map(w => {
    if (w.kind !== "pred") {
      throw new Error("Expected a predicate")
    }
    return w
  })
  const order = ctx.order.map(o => {
    if (o.kind !== "order") {
      throw new Error("Expected an ordering")
    }
    return o
  })
  const root = planRoot(ctx.source.table)
  const chains: Array<readonly string[]> = []
  for (const item of selection) collectChains(item, chains)
  for (const w of where) collectChains(w, chains)
  for (const o of order) collectChains(o, chains)
  for (const chain of chains) ensureChain(root, chain)
  return {
    ...ctx,
    selection,
    where,
    order,
    root,
    projection: projectionOf(selection, ctx.mode)
  }
}
