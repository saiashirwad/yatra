import { ManyToManyRelation, Relation } from "./relation.ts"
import { info, tableName } from "./table.ts"
import type { Tableish } from "./utils.ts"
import {
  isAggSpec,
  type AggSpec,
  type QueryContext,
  type WhereClause
} from "./query.ts"
export interface CompiledQuery {
  readonly dialect: string
  readonly sql: string
  readonly params: readonly unknown[]
}
export interface Compiler {
  readonly dialect: string
  compile(ctx: QueryContext<any, any, any>): CompiledQuery
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
const stripAlias = (path: string) => {
  const i = path.indexOf(" as ")
  return i === -1 ? path : path.slice(0, i)
}
const takeAlias = (path: string) => {
  const i = path.indexOf(" as ")
  return i === -1 ? undefined : path.slice(i + 4)
}
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
function ensurePath(root: TreeNode, path: string) {
  const segments = stripAlias(path).split(".")
  let node = root
  for (const seg of segments.slice(0, -1)) {
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
function resolveColumn(
  root: TreeNode,
  path: string
): string {
  const segments = stripAlias(path).split(".")
  let node = root
  for (const seg of segments.slice(0, -1)) {
    const child = node.children.get(seg)
    if (!child) {
      throw new Error(`No join found for path '${path}'`)
    }
    node = child
  }
  return `${qi(node.alias)}.${qi(segments[segments.length - 1])}`
}
interface SelectExpr {
  sql: string
  alias?: string
}
type AddParam = (value: unknown) => string
function compileItems(
  root: TreeNode,
  items: readonly unknown[],
  mode: "flat" | "hydrate",
  p: AddParam
): SelectExpr[] {
  const out: SelectExpr[] = []
  for (const item of items) {
    if (typeof item === "string") {
      const base = stripAlias(item)
      const explicit = takeAlias(item)
      const dotted = base.includes(".")
      const sql = dotted
        ? resolveColumn(root, base)
        : `${qi(root.alias)}.${qi(base)}`
      const alias =
        explicit ??
        (dotted
          ? mode === "hydrate"
            ? flatAlias(base)
            : base
          : base)
      out.push(alias ? { sql, alias } : { sql })
    } else if (isAggSpec(item)) {
      out.push({
        sql: compileAgg(root, item, p),
        alias: item.alias ?? item.relation
      })
    } else {
      throw new Error(
        `Invalid selection item: ${String(item)}`
      )
    }
  }
  return out
}
function compileAgg(
  source: TreeNode,
  spec: AggSpec,
  p: AddParam
): string {
  const relation = info(source.table).relations[
    spec.relation
  ]
  if (!relation) {
    throw new Error(
      `'${spec.relation}' is not a relation of table '${tableName(source.table)}'`
    )
  }
  const dest = relation.destinationTable
  const destName = tableName(dest)
  const subAlias = `${source.alias}_${spec.relation}`
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
  if (spec.kind === "count") {
    return (
      `(SELECT count(*)::int FROM ${qi(destName)} ${qi(subAlias)}` +
      ` WHERE ${cond})`
    )
  }
  const subRoot = makeRoot(dest, subAlias)
  for (const item of spec.items) {
    if (typeof item === "string") ensurePath(subRoot, item)
  }
  const inner = compileItems(
    subRoot,
    spec.items,
    "hydrate",
    p
  )
  const buildArgs = inner
    .flatMap(it => [`'${it.alias ?? it.sql}'`, it.sql])
    .join(", ")
  return (
    `coalesce((SELECT jsonb_agg(DISTINCT jsonb_build_object(${buildArgs}))` +
    ` FROM ${qi(destName)} ${qi(subAlias)}${renderJoins(subRoot)}` +
    ` WHERE ${cond}), '[]'::jsonb)`
  )
}
function renderWhere(
  root: TreeNode,
  w: WhereClause,
  p: AddParam
): string {
  const col = resolveColumn(root, w.path)
  switch (w.op) {
    case "in":
      return `${col} = ANY(${p(w.value)})`
    case "not in":
      return `${col} <> ALL(${p(w.value)})`
    case "is":
      return `${col} IS NULL`
    case "is not":
      return `${col} IS NOT NULL`
    default:
      return `${col} ${w.op.toUpperCase()} ${p(w.value)}`
  }
}
export const postgres: Compiler = {
  dialect: "postgres",
  compile(ctx) {
    const params: unknown[] = []
    const p: AddParam = value => {
      params.push(value)
      return `$${params.length}`
    }
    const base = tableName(ctx.table)
    const root = makeRoot(ctx.table, base)
    const paths: string[] = []
    for (const item of ctx.selection) {
      if (typeof item === "string") paths.push(item)
    }
    for (const w of ctx.where) paths.push(w.path)
    for (const o of ctx.orderBy) paths.push(o.path)
    for (const path of paths) ensurePath(root, path)
    const exprs =
      ctx.selection.length > 0
        ? compileItems(root, ctx.selection, ctx.mode, p)
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
        `WHERE ${ctx.where.map(w => renderWhere(root, w, p)).join(" AND ")}`
      )
    }
    if (ctx.orderBy.length > 0) {
      clauses.push(
        `ORDER BY ${ctx.orderBy
          .map(
            o =>
              `${resolveColumn(root, o.path)} ${o.direction.toUpperCase()}`
          )
          .join(", ")}`
      )
    }
    if (ctx.limit !== undefined)
      clauses.push(`LIMIT ${ctx.limit}`)
    if (ctx.offset !== undefined) {
      clauses.push(`OFFSET ${ctx.offset}`)
    }
    return {
      dialect: "postgres",
      sql: clauses.join("\n"),
      params
    }
  }
}
export function toSQL<
  T extends Tableish,
  M extends "flat" | "hydrate",
  Items extends readonly unknown[]
>(ctx: QueryContext<T, M, Items>): CompiledQuery {
  return postgres.compile(ctx)
}
