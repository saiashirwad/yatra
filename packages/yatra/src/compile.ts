import { tableFields, tableName } from "./table.ts"
import type { Tableish } from "./utils.ts"
import type {
  AggData,
  ColData,
  ExprData,
  LitData,
  NodeData,
  PredData,
  RelData
} from "./ref.ts"
import {
  plan,
  planScope,
  projectionOf,
  type Plan,
  type PlanNode,
  type ProjectionField
} from "./plan.ts"
import type { Relation } from "./relation.ts"
import type { QueryContext } from "./query.ts"
export interface CompiledQuery {
  readonly dialect: string
  readonly sql: string
  readonly params: readonly unknown[]
  /** what each result column decodes to — hydrate reads this, it
   * never re-derives column names */
  readonly projection: readonly ProjectionField[]
}
export type StatementContext = QueryContext<
  any,
  any,
  any,
  any
>
export interface Compiler {
  readonly dialect: string
  compile(ctx: StatementContext): CompiledQuery
}
export function compileWith<C extends Compiler>(
  compiler: C
) {
  return <
    T extends Tableish,
    M extends "flat" | "hydrate",
    Items extends readonly unknown[]
  >(
    ctx: QueryContext<T, M, Items>
  ): CompiledQuery => compiler.compile(ctx)
}
const qi = (ident: string) => `"${ident}"`
type AddParam = (value: unknown) => string
// --- aliases: a SQL physical concern, derived from the plan tree ---
type Aliases = Map<PlanNode, string>
function aliasSubTree(
  node: PlanNode,
  alias: string,
  aliases: Aliases
) {
  aliases.set(node, alias)
  for (const child of node.children.values()) {
    aliasSubTree(child, `${alias}_${child.name}`, aliases)
  }
}
const aliasOf = (
  aliases: Aliases,
  node: PlanNode
): string => aliases.get(node)!
function resolveNode(
  root: PlanNode,
  chain: readonly string[]
): PlanNode {
  let node = root
  for (const seg of chain) {
    const child = node.children.get(seg)
    if (!child) {
      throw new Error(`No join found for relation '${seg}'`)
    }
    node = child
  }
  return node
}
function renderJoin(
  aliases: Aliases,
  parent: PlanNode,
  child: PlanNode
): string {
  const join = child.join!
  const destName = tableName(child.table)
  const childAlias = qi(aliasOf(aliases, child))
  const parentAlias = qi(aliasOf(aliases, parent))
  if (join.kind === "m2m") {
    const jtAlias = qi(`${aliasOf(aliases, child)}__jt`)
    return (
      ` LEFT JOIN ${qi(join.joinTable)} ${jtAlias}` +
      ` ON ${jtAlias}.${qi(join.joinSourceCol)} = ${parentAlias}.${qi(join.sourceField)}` +
      ` LEFT JOIN ${qi(destName)} ${childAlias}` +
      ` ON ${childAlias}.${qi(join.destinationField)} = ${jtAlias}.${qi(join.joinDestCol)}`
    )
  }
  return (
    ` LEFT JOIN ${qi(destName)} ${childAlias}` +
    ` ON ${childAlias}.${qi(join.destCol)} = ${parentAlias}.${qi(join.sourceCol)}`
  )
}
function renderJoins(
  aliases: Aliases,
  node: PlanNode
): string {
  let sql = ""
  for (const child of node.children.values()) {
    sql += renderJoin(aliases, node, child)
    sql += renderJoins(aliases, child)
  }
  return sql
}
// --- node → SQL (dispatch on op; kinds are core, ops are open) ---
function colSql(
  aliases: Aliases,
  root: PlanNode,
  data: ColData
): string {
  const node = resolveNode(root, data.chain)
  return `${qi(aliasOf(aliases, node))}.${qi(data.key)}`
}
function valueSql(
  aliases: Aliases,
  root: PlanNode,
  data: NodeData,
  p: AddParam
): string {
  switch (data.kind) {
    case "col":
      return colSql(aliases, root, data)
    case "expr":
      return exprSql(aliases, root, data, p)
    case "lit":
      return p(data.value)
    default:
      throw new Error(
        `Invalid argument of kind '${data.kind}' (dialect 'postgres')`
      )
  }
}
function exprSql(
  aliases: Aliases,
  root: PlanNode,
  data: ExprData,
  p: AddParam
): string {
  const arg = (d: NodeData) => valueSql(aliases, root, d, p)
  switch (data.op) {
    case "lower":
      return `lower(${arg(data.args[0])})`
    case "mul":
      return `(${arg(data.args[0])} * ${arg(data.args[1])})`
    default:
      throw new Error(
        `no sql handler for expr op '${data.op}' (dialect 'postgres')`
      )
  }
}
function itemSql(
  aliases: Aliases,
  root: PlanNode,
  data: NodeData,
  p: AddParam
): string {
  switch (data.kind) {
    case "col":
      return colSql(aliases, root, data)
    case "as":
      return itemSql(aliases, root, data.target, p)
    case "expr":
      return exprSql(aliases, root, data, p)
    case "agg":
      return aggSql(aliases, root, data, p)
    default:
      throw new Error(
        `Item of kind '${data.kind}' is not selectable`
      )
  }
}
function aggSql(
  aliases: Aliases,
  source: PlanNode,
  spec: AggData,
  p: AddParam
): string {
  const relation = spec.relation
  const dest = relation.destinationTable
  const destName = tableName(dest)
  const subAlias = `${aliasOf(aliases, source)}_${spec.key}`
  const [srcCol, dstCol] = fkCols(relation)
  const cond = `${qi(subAlias)}.${qi(dstCol)} = ${qi(aliasOf(aliases, source))}.${qi(srcCol)}`
  if (spec.aggKind === "count") {
    return (
      `(SELECT count(*)::int FROM ${qi(destName)} ${qi(subAlias)}` +
      ` WHERE ${cond})`
    )
  }
  if (spec.aggKind !== "array") {
    throw new Error(
      `no sql handler for agg kind '${spec.aggKind}' (dialect 'postgres')`
    )
  }
  const subRoot = planScope(dest, spec.items)
  const subAliases: Aliases = new Map()
  aliasSubTree(subRoot, subAlias, subAliases)
  const innerProj = projectionOf(spec.items, "hydrate")
  const buildArgs = spec.items
    .map((item, i) => {
      const sql = itemSql(subAliases, subRoot, item, p)
      return [
        `'${innerProj[i].col.replaceAll("'", "''")}'`,
        sql
      ]
    })
    .flat()
    .join(", ")
  return (
    `coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object(${buildArgs}))` +
    ` FROM ${qi(destName)} ${qi(subAlias)}${renderJoins(subAliases, subRoot)}` +
    ` WHERE ${cond}), '[]'::jsonb)`
  )
}
// aggs and exists correlate on a plain foreign-key relation
function fkCols(
  rel: Relation<any, any>
): [sourceCol: string, destCol: string] {
  if (!("foreignKey" in rel)) {
    throw new Error(
      "jsonAgg/count/whereExists over many-to-many relations is not supported yet"
    )
  }
  const r = rel as unknown as {
    foreignKey: unknown
    referencedKey?: unknown
  }
  const fk = String(r.foreignKey)
  const rk = String(r.referencedKey)
  const [fkTable, fkCol] = fk.split(".")
  const [rkTable, rkCol] = rk.split(".")
  if (fkCol === undefined || rkCol === undefined) {
    throw new Error(
      `Join keys must be qualified ('table.column'), got foreignKey='${fk}' referencedKey='${rk}'`
    )
  }
  const destName = tableName(rel.destinationTable)
  return fkTable === destName
    ? [rkCol, fkCol]
    : rkTable === destName
      ? [fkCol, rkCol]
      : [fkCol, rkCol]
}
function whereSql(
  aliases: Aliases,
  root: PlanNode,
  pred: PredData,
  p: AddParam
): string {
  const arg = (d: NodeData) => valueSql(aliases, root, d, p)
  const sub = (d: NodeData): string => {
    if (d.kind !== "pred") {
      throw new Error("Expected a predicate")
    }
    return whereSql(aliases, root, d, p)
  }
  const [a0, a1] = pred.args
  switch (pred.op) {
    case "eq":
      return `${arg(a0)} = ${arg(a1)}`
    case "ne":
      return `${arg(a0)} <> ${arg(a1)}`
    case "gt":
      return `${arg(a0)} > ${arg(a1)}`
    case "gte":
      return `${arg(a0)} >= ${arg(a1)}`
    case "lt":
      return `${arg(a0)} < ${arg(a1)}`
    case "lte":
      return `${arg(a0)} <= ${arg(a1)}`
    case "like":
      return `${arg(a0)} LIKE ${arg(a1)}`
    case "ilike":
      return `${arg(a0)} ILIKE ${arg(a1)}`
    case "in":
      return `${arg(a0)} = ANY(${p((a1 as LitData).value)})`
    case "isNull":
      return `${arg(a0)} IS NULL`
    case "isNotNull":
      return `${arg(a0)} IS NOT NULL`
    case "exists": {
      const rel = pred.args[0] as RelData
      const relation = rel.relation
      if (!("foreignKey" in relation)) {
        throw new Error(
          "whereExists over many-to-many relations is not supported yet"
        )
      }
      const dest = relation.destinationTable
      const destName = tableName(dest)
      const parentNode = resolveNode(
        root,
        rel.chain.slice(0, -1)
      )
      const subAlias = `${aliasOf(aliases, parentNode)}_${rel.key}`
      const [srcCol, dstCol] = fkCols(relation)
      const conds = [
        `${qi(subAlias)}.${qi(dstCol)} = ${qi(aliasOf(aliases, parentNode))}.${qi(srcCol)}`
      ]
      const subRoot = planScope(dest, pred.args.slice(1))
      const subAliases: Aliases = new Map()
      aliasSubTree(subRoot, subAlias, subAliases)
      for (const sp of pred.args.slice(1)) {
        conds.push(
          whereSql(subAliases, subRoot, sp as PredData, p)
        )
      }
      return (
        `EXISTS (SELECT 1 FROM ${qi(destName)} ${qi(subAlias)}` +
        `${renderJoins(subAliases, subRoot)} WHERE ${conds.join(" AND ")})`
      )
    }
    case "and":
      return `(${pred.args.map(sub).join(" AND ")})`
    case "or":
      return `(${pred.args.map(sub).join(" OR ")})`
    case "not":
      return `NOT (${sub(a0)})`
    default:
      throw new Error(
        `no sql handler for pred op '${pred.op}' (dialect 'postgres')`
      )
  }
}
/** limit/offset are inert `lit` nodes — compilers validate them. */
function bound(node: LitData, what: string): number {
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
function selectList(
  aliases: Aliases,
  root: PlanNode,
  selection: readonly NodeData[],
  projection: readonly ProjectionField[],
  p: AddParam
): string {
  return selection
    .map((item, i) => {
      const sql = itemSql(aliases, root, item, p)
      return `${sql} AS ${qi(projection[i].col)}`
    })
    .join(", ")
}
function mutationSql(plan: Plan, p: AddParam): string {
  if ((plan.mode as string) !== "flat") {
    throw new Error("mutations do not support hydrate")
  }
  if (
    plan.orderBy.length > 0 ||
    plan.limit !== undefined ||
    plan.offset !== undefined
  ) {
    throw new Error(
      "mutations do not support orderBy/limit/offset"
    )
  }
  const base = tableName(plan.table)
  const root = plan.root
  const aliases: Aliases = new Map()
  aliasSubTree(root, base, aliases)
  const fields = tableFields(plan.table)
  const checkKeys = (keys: Iterable<string>) => {
    for (const k of keys) {
      if (!(k in fields)) {
        throw new Error(
          `Unknown column '${k}' for table '${base}'`
        )
      }
    }
  }
  const clauses: string[] = []
  if (plan.kind === "insert") {
    const rows = plan.rows ?? []
    if (plan.where.length > 0) {
      throw new Error("insert does not take where")
    }
    if (rows.length === 0) {
      throw new Error("insert needs at least one row")
    }
    const keys: string[] = []
    for (const row of rows) {
      checkKeys(Object.keys(row))
      for (const k of Object.keys(row)) {
        if (!keys.includes(k)) keys.push(k)
      }
    }
    if (keys.length === 0) {
      clauses.push(`INSERT INTO ${qi(base)} DEFAULT VALUES`)
    } else {
      const cols = keys.map(qi).join(", ")
      const vals = rows
        .map(
          row =>
            `(${keys
              .map(k => (k in row ? p(row[k]) : "DEFAULT"))
              .join(", ")})`
        )
        .join(", ")
      clauses.push(
        `INSERT INTO ${qi(base)} (${cols}) VALUES ${vals}`
      )
    }
  } else if (plan.kind === "update") {
    const set = plan.set ?? {}
    const keys = Object.keys(set)
    if (keys.length === 0) {
      throw new Error(
        "update needs at least one column to set"
      )
    }
    checkKeys(keys)
    clauses.push(
      `UPDATE ${qi(base)} SET ${keys
        .map(k => `${qi(k)} = ${p(set[k])}`)
        .join(", ")}`
    )
  } else {
    clauses.push(`DELETE FROM ${qi(base)}`)
  }
  if (plan.kind !== "insert" && plan.where.length > 0) {
    clauses.push(
      `WHERE ${plan.where
        .map(w => whereSql(aliases, root, w, p))
        .join(" AND ")}`
    )
  }
  if (plan.selection.length > 0) {
    clauses.push(
      `RETURNING ${selectList(aliases, root, plan.selection, plan.projection, p)}`
    )
  }
  return clauses.join("\n")
}
function querySql(plan: Plan, p: AddParam): string {
  const base = tableName(plan.table)
  const root = plan.root
  const aliases: Aliases = new Map()
  aliasSubTree(root, base, aliases)
  const list =
    plan.selection.length > 0
      ? selectList(
          aliases,
          root,
          plan.selection,
          plan.projection,
          p
        )
      : `${qi(base)}.*`
  const clauses = [
    `SELECT ${list}`,
    `FROM ${qi(base)} ${qi(base)}${renderJoins(aliases, root)}`
  ]
  if (plan.where.length > 0) {
    clauses.push(
      `WHERE ${plan.where
        .map(w => whereSql(aliases, root, w, p))
        .join(" AND ")}`
    )
  }
  if (plan.orderBy.length > 0) {
    clauses.push(
      `ORDER BY ${plan.orderBy
        .map(
          o =>
            `${valueSql(aliases, root, o.ref, p)} ${o.direction.toUpperCase()}`
        )
        .join(", ")}`
    )
  }
  if (plan.limit !== undefined) {
    clauses.push(`LIMIT ${p(bound(plan.limit, "limit"))}`)
  }
  if (plan.offset !== undefined) {
    clauses.push(
      `OFFSET ${p(bound(plan.offset, "offset"))}`
    )
  }
  return clauses.join("\n")
}
export const postgres: Compiler = {
  dialect: "postgres",
  compile(ctx) {
    const params: unknown[] = []
    const p: AddParam = value => {
      params.push(value)
      return `$${params.length}`
    }
    const planned = plan(ctx)
    const sql =
      planned.kind !== undefined
        ? mutationSql(planned, p)
        : querySql(planned, p)
    return {
      dialect: "postgres",
      sql,
      params,
      projection: planned.projection
    }
  }
}
export function toSQL(
  ctx: StatementContext
): CompiledQuery {
  return postgres.compile(ctx)
}
