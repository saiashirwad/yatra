import { ManyToManyRelation, Relation } from "./relation.ts"
import { info, tableFields, tableName } from "./table.ts"
import type { Tableish } from "./utils.ts"
import {
  dataOf,
  type AggData,
  type ColData,
  type ExprData,
  type NodeData,
  type PredData,
  type RelData
} from "./ref.ts"
import type { MutationContext } from "./mutation.ts"
import type { QueryContext } from "./query.ts"
export interface CompiledQuery {
  readonly dialect: string
  readonly sql: string
  readonly params: readonly unknown[]
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
export const flatAlias = (path: string) =>
  path.replaceAll(".", "__")
interface TreeNode {
  alias: string
  table: Tableish
  name?: string
  relation?: Relation<any, any>
  children: Map<string, TreeNode>
}
const makeRoot = (
  table: Tableish,
  alias: string
): TreeNode => ({
  alias,
  table,
  children: new Map()
})
function ensureChain(
  root: TreeNode,
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
        alias: `${node.alias}_${seg}`,
        relation,
        table: relation.destinationTable,
        children: new Map()
      }
      node.children.set(seg, child)
    }
    node = child
  }
}
function joinColumns(
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
function renderJoin(
  parent: TreeNode,
  child: TreeNode
): string {
  const rel = child.relation!
  const destName = tableName(child.table)
  if (rel instanceof ManyToManyRelation) {
    const jtAlias = `${child.alias}__jt`
    const srcCol = rel.sourceKey.replace(".", "_")
    const dstCol = rel.destinationKey.replace(".", "_")
    const srcField = rel.sourceKey.split(".")[1]
    const dstField = rel.destinationKey.split(".")[1]
    return (
      ` LEFT JOIN ${qi(rel.joinTable)} ${qi(jtAlias)}` +
      ` ON ${qi(jtAlias)}.${qi(srcCol)} = ${qi(parent.alias)}.${qi(srcField)}` +
      ` LEFT JOIN ${qi(destName)} ${qi(child.alias)}` +
      ` ON ${qi(child.alias)}.${qi(dstField)} = ${qi(jtAlias)}.${qi(dstCol)}`
    )
  }
  if ("foreignKey" in rel) {
    const [srcCol, dstCol] = joinColumns(rel, destName)
    return (
      ` LEFT JOIN ${qi(destName)} ${qi(child.alias)}` +
      ` ON ${qi(child.alias)}.${qi(dstCol)} = ${qi(parent.alias)}.${qi(srcCol)}`
    )
  }
  throw new Error(`Unsupported relation '${child.name}'`)
}
function renderJoins(node: TreeNode): string {
  let sql = ""
  for (const child of node.children.values()) {
    sql += renderJoin(node, child)
    sql += renderJoins(child)
  }
  return sql
}
function resolveNode(
  root: TreeNode,
  chain: readonly string[]
): TreeNode {
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
function resolveChain(
  root: TreeNode,
  chain: readonly string[],
  key: string
): string {
  const node = resolveNode(root, chain)
  return `${qi(node.alias)}.${qi(key)}`
}
interface SelectExpr {
  sql: string
  alias?: string
}
type AddParam = (value: unknown) => string
// Ops store arguments inconsistently: predicate args are node objects
// (RefData-branded), expression args are bare NodeData. Accept both.
function argData(a: unknown): NodeData | undefined {
  const d = dataOf(a)
  if (d) return d
  if (
    typeof a === "object" &&
    a !== null &&
    typeof (a as NodeData).kind === "string"
  ) {
    return a as NodeData
  }
  return undefined
}
function collectChains(
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
      for (const a of data.args) {
        const d = argData(a)
        if (d) collectChains(d, out)
      }
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
      for (const a of data.args) {
        const d = argData(a)
        if (d) collectChains(d, out)
      }
      break
    case "order":
      collectChains(data.ref, out)
      break
    default:
      break
  }
}
function compileColSql(
  root: TreeNode,
  data: ColData
): string {
  return resolveChain(root, data.chain, data.key)
}
function compileExprSql(
  root: TreeNode,
  data: ExprData,
  p: AddParam
): string {
  const argSql = (a: unknown): string => {
    const d = argData(a)
    if (!d) return p(a)
    if (d.kind === "col") return compileColSql(root, d)
    if (d.kind === "expr") return compileExprSql(root, d, p)
    throw new Error(
      `Invalid expression argument of kind '${d.kind}'`
    )
  }
  switch (data.op) {
    case "lower":
      return `lower(${argSql(data.args[0])})`
    case "mul":
      return `(${argSql(data.args[0])} * ${argSql(data.args[1])})`
    default:
      throw new Error(`Unknown expression op '${data.op}'`)
  }
}
function compileItem(
  root: TreeNode,
  item: unknown,
  mode: "flat" | "hydrate",
  p: AddParam
): SelectExpr {
  const data = dataOf(item)
  if (!data) {
    throw new Error(
      `Invalid selection item: ${String(item)}`
    )
  }
  return compileItemData(root, data, mode, p)
}
function compileItemData(
  root: TreeNode,
  data: NodeData,
  mode: "flat" | "hydrate",
  p: AddParam
): SelectExpr {
  switch (data.kind) {
    case "col": {
      const sql = compileColSql(root, data)
      const dotted = [...data.chain, data.key].join(".")
      const alias =
        data.chain.length > 0
          ? mode === "hydrate"
            ? flatAlias(dotted)
            : dotted
          : data.key
      return { sql, alias }
    }
    case "as": {
      const inner = compileItemData(
        root,
        data.target,
        mode,
        p
      )
      return { sql: inner.sql, alias: data.alias }
    }
    case "expr":
      return { sql: compileExprSql(root, data, p) }
    case "agg":
      return {
        sql: compileAgg(root, data, p),
        alias: data.key
      }
    default:
      throw new Error(
        `Item of kind '${data.kind}' is not selectable`
      )
  }
}
function compileAgg(
  source: TreeNode,
  spec: AggData,
  p: AddParam
): string {
  const relation = spec.relation
  const dest = relation.destinationTable
  const destName = tableName(dest)
  const subAlias = `${source.alias}_${spec.key}`
  if (relation instanceof ManyToManyRelation) {
    throw new Error(
      "jsonAgg/count over many-to-many relations is not supported yet"
    )
  }
  const [srcCol, dstCol] = joinColumns(
    relation as any,
    destName
  )
  const cond = `${qi(subAlias)}.${qi(dstCol)} = ${qi(source.alias)}.${qi(srcCol)}`
  if (spec.aggKind === "count") {
    return (
      `(SELECT count(*)::int FROM ${qi(destName)} ${qi(subAlias)}` +
      ` WHERE ${cond})`
    )
  }
  const subRoot = makeRoot(dest, subAlias)
  const chains: Array<readonly string[]> = []
  for (const item of spec.items) {
    const d = dataOf(item)
    if (d) collectChains(d, chains)
  }
  for (const chain of chains) ensureChain(subRoot, chain)
  const inner = spec.items.map(item =>
    compileItem(subRoot, item, "hydrate", p)
  )
  const buildArgs = inner
    .flatMap(it => [
      `'${(it.alias ?? it.sql).replaceAll("'", "''")}'`,
      it.sql
    ])
    .join(", ")
  return (
    `coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object(${buildArgs}))` +
    ` FROM ${qi(destName)} ${qi(subAlias)}${renderJoins(subRoot)}` +
    ` WHERE ${cond}), '[]'::jsonb)`
  )
}
function renderWhere(
  root: TreeNode,
  pred: PredData,
  p: AddParam
): string {
  const argSql = (a: unknown): string => {
    const d = argData(a)
    if (!d) return p(a)
    if (d.kind === "col") return compileColSql(root, d)
    if (d.kind === "expr") return compileExprSql(root, d, p)
    throw new Error(
      `Invalid where argument of kind '${d.kind}'`
    )
  }
  const sub = (a: unknown): string => {
    const d = dataOf(a)
    if (!d || d.kind !== "pred") {
      throw new Error("Expected a predicate")
    }
    return renderWhere(root, d, p)
  }
  const [a0, a1] = pred.args
  switch (pred.op) {
    case "eq":
      return `${argSql(a0)} = ${argSql(a1)}`
    case "ne":
      return `${argSql(a0)} <> ${argSql(a1)}`
    case "gt":
      return `${argSql(a0)} > ${argSql(a1)}`
    case "gte":
      return `${argSql(a0)} >= ${argSql(a1)}`
    case "lt":
      return `${argSql(a0)} < ${argSql(a1)}`
    case "lte":
      return `${argSql(a0)} <= ${argSql(a1)}`
    case "like":
      return `${argSql(a0)} LIKE ${argSql(a1)}`
    case "ilike":
      return `${argSql(a0)} ILIKE ${argSql(a1)}`
    case "in":
      return `${argSql(a0)} = ANY(${p(a1)})`
    case "isNull":
      return `${argSql(a0)} IS NULL`
    case "isNotNull":
      return `${argSql(a0)} IS NOT NULL`
    case "exists": {
      const rel = pred.args[0] as RelData
      const relation = rel.relation
      if (relation instanceof ManyToManyRelation) {
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
      const subAlias = `${parentNode.alias}_${rel.key}`
      const [srcCol, dstCol] = joinColumns(
        relation as any,
        destName
      )
      const conds = [
        `${qi(subAlias)}.${qi(dstCol)} = ${qi(parentNode.alias)}.${qi(srcCol)}`
      ]
      const subRoot = makeRoot(dest, subAlias)
      const chains: Array<readonly string[]> = []
      for (const sp of pred.args.slice(1)) {
        const d = argData(sp)
        if (d) collectChains(d, chains)
      }
      for (const chain of chains)
        ensureChain(subRoot, chain)
      for (const sp of pred.args.slice(1)) {
        conds.push(
          renderWhere(subRoot, argData(sp) as PredData, p)
        )
      }
      return (
        `EXISTS (SELECT 1 FROM ${qi(destName)} ${qi(subAlias)}` +
        `${renderJoins(subRoot)} WHERE ${conds.join(" AND ")})`
      )
    }
    case "and":
      return `(${pred.args.map(sub).join(" AND ")})`
    case "or":
      return `(${pred.args.map(sub).join(" OR ")})`
    case "not":
      return `NOT (${sub(a0)})`
  }
}
function mutationSql(
  ctx: MutationContext<any, any>,
  p: AddParam
): string {
  if ((ctx.mode as string) !== "flat") {
    throw new Error("mutations do not support hydrate")
  }
  if (
    ctx.orderBy.length > 0 ||
    ctx.limit !== undefined ||
    ctx.offset !== undefined
  ) {
    throw new Error(
      "mutations do not support orderBy/limit/offset"
    )
  }
  const base = tableName(ctx.table)
  const root = makeRoot(ctx.table, base)
  const fields = tableFields(ctx.table)
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
  if (ctx.kind === "insert") {
    const rows = ctx.rows ?? []
    if (ctx.where.length > 0) {
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
  } else if (ctx.kind === "update") {
    const set = ctx.set ?? {}
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
  if (ctx.kind !== "insert" && ctx.where.length > 0) {
    clauses.push(
      `WHERE ${ctx.where
        .map(w =>
          renderWhere(root, dataOf(w) as PredData, p)
        )
        .join(" AND ")}`
    )
  }
  if (ctx.selection.length > 0) {
    const list = ctx.selection
      .map((item: unknown) => {
        const e = compileItem(root, item, "flat", p)
        return e.alias
          ? `${e.sql} AS ${qi(e.alias)}`
          : e.sql
      })
      .join(", ")
    clauses.push(`RETURNING ${list}`)
  }
  return clauses.join("\n")
}
function querySql(
  ctx: QueryContext<any, any, any>,
  p: AddParam
): string {
  const base = tableName(ctx.table)
  const root = makeRoot(ctx.table, base)
  const chains: Array<readonly string[]> = []
  for (const item of ctx.selection) {
    const d = dataOf(item)
    if (d) collectChains(d, chains)
  }
  for (const w of ctx.where) {
    const d = dataOf(w)
    if (d) collectChains(d, chains)
  }
  for (const o of ctx.orderBy) {
    const d = dataOf(o)
    if (d) collectChains(d, chains)
  }
  for (const chain of chains) {
    ensureChain(root, chain)
  }
  const exprs: SelectExpr[] =
    ctx.selection.length > 0
      ? ctx.selection.map((item: unknown) =>
          compileItem(root, item, ctx.mode, p)
        )
      : [{ sql: `${qi(root.alias)}.*` }]
  const selectList = exprs
    .map(e =>
      e.alias ? `${e.sql} AS ${qi(e.alias)}` : e.sql
    )
    .join(", ")
  const clauses = [
    `SELECT ${selectList}`,
    `FROM ${qi(base)} ${qi(root.alias)}${renderJoins(root)}`
  ]
  if (ctx.where.length > 0) {
    clauses.push(
      `WHERE ${ctx.where
        .map(w =>
          renderWhere(root, dataOf(w) as PredData, p)
        )
        .join(" AND ")}`
    )
  }
  if (ctx.orderBy.length > 0) {
    clauses.push(
      `ORDER BY ${ctx.orderBy
        .map(o => {
          const d = dataOf(o) as {
            direction: "asc" | "desc"
            ref: NodeData
          }
          const ref = d.ref as ColData
          return `${compileColSql(root, ref)} ${d.direction.toUpperCase()}`
        })
        .join(", ")}`
    )
  }
  if (ctx.limit !== undefined)
    clauses.push(`LIMIT ${ctx.limit}`)
  if (ctx.offset !== undefined) {
    clauses.push(`OFFSET ${ctx.offset}`)
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
    const sql =
      "kind" in ctx
        ? mutationSql(ctx as MutationContext<any, any>, p)
        : querySql(ctx, p)
    return {
      dialect: "postgres",
      sql,
      params
    }
  }
}
export function toSQL(
  ctx: StatementContext
): CompiledQuery {
  return postgres.compile(ctx)
}
