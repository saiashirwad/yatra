import { tableFields, tableName } from "./table.ts"
import type { Tableish } from "./utils.ts"
import type { LitData, NodeData } from "./ref.ts"
import {
  plan,
  planScope,
  resolveJoin,
  type Plan,
  type PlanNode,
  type ProjectionField
} from "./plan.ts"
import type { Relation } from "./relation.ts"
import type { QueryContext } from "./query.ts"
import {
  buildRegistry,
  type OpPack,
  type SqlCtx,
  type SqlScope
} from "./registry.ts"
import { defaultPacks } from "./packs.ts"

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

export interface CompilerConfig {
  readonly dialect: string
  readonly quote?: (ident: string) => string
  readonly param?: (index: number) => string
  readonly packs?: readonly OpPack[]
  /** packs allowed to replace ops from `packs` (dialect lowerings) */
  readonly overrides?: readonly OpPack[]
}

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

// aggs and exists correlate on a plain foreign-key relation
function fkCols(
  rel: Relation<any, any>
): [sourceCol: string, destCol: string] {
  const join = resolveJoin(rel)
  if (join.kind === "m2m") {
    throw new Error(
      "jsonAgg/count/whereExists over many-to-many relations is not supported yet"
    )
  }
  return [join.sourceCol, join.destCol]
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

/**
 * Assemble a SQL compiler from op packs. The shell owns statement
 * structure (SELECT/FROM/joins/WHERE/ORDER/mutations); every op —
 * predicate, expression, aggregation — renders through the registry.
 */
export function makeCompiler(
  config: CompilerConfig
): Compiler {
  const {
    dialect,
    quote = ident => `"${ident}"`,
    param = i => `$${i}`,
    packs = defaultPacks,
    overrides = []
  } = config
  const registry = buildRegistry(packs, overrides)
  const qi = quote

  /** Emit services for one scope (root query or a sub-select). */
  function makeCtx(
    aliases: Aliases,
    root: PlanNode,
    p: AddParam
  ): SqlCtx {
    const ctx: SqlCtx = {
      value(node) {
        switch (node.kind) {
          case "col": {
            const n = resolveNode(root, node.chain)
            return `${qi(aliases.get(n)!)}.${qi(node.key)}`
          }
          case "lit":
            return p(node.value)
          case "expr": {
            const h = registry.expr[node.op]?.sql
            if (!h) {
              throw new Error(
                `no sql handler for expr op '${node.op}' (dialect '${dialect}')`
              )
            }
            return h(node.args, ctx)
          }
          case "as":
            return ctx.value(node.target)
          case "agg": {
            const h = registry.agg[node.aggKind]?.sql
            if (!h) {
              throw new Error(
                `no sql handler for agg kind '${node.aggKind}' (dialect '${dialect}')`
              )
            }
            return h(node, ctx)
          }
          default:
            throw new Error(
              `Invalid argument of kind '${node.kind}' (dialect '${dialect}')`
            )
        }
      },
      pred(node) {
        if (node.kind !== "pred") {
          throw new Error("Expected a predicate")
        }
        const h = registry.pred[node.op]?.sql
        if (!h) {
          throw new Error(
            `no sql handler for pred op '${node.op}' (dialect '${dialect}')`
          )
        }
        return h(node.args, ctx)
      },
      param: p,
      quote: qi,
      scope(relation, key, parentChain, nodes): SqlScope {
        const parentNode = resolveNode(root, parentChain)
        const subAlias = `${aliases.get(parentNode)!}_${key}`
        const [srcCol, dstCol] = fkCols(relation)
        const dest = relation.destinationTable
        const subRoot = planScope(dest, nodes)
        const subAliases: Aliases = new Map()
        aliasSubTree(subRoot, subAlias, subAliases)
        const sub = makeCtx(subAliases, subRoot, p)
        return {
          from: `${qi(tableName(dest))} ${qi(subAlias)}${renderJoins(subAliases, subRoot)}`,
          correlation: `${qi(subAlias)}.${qi(dstCol)} = ${qi(aliases.get(parentNode)!)}.${qi(srcCol)}`,
          value: sub.value,
          pred: sub.pred
        }
      }
    }
    return ctx
  }

  function renderJoin(
    aliases: Aliases,
    parent: PlanNode,
    child: PlanNode
  ): string {
    const join = child.join!
    const destName = tableName(child.table)
    const childAlias = qi(aliases.get(child)!)
    const parentAlias = qi(aliases.get(parent)!)
    if (join.kind === "m2m") {
      const jtAlias = qi(`${aliases.get(child)!}__jt`)
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

  function selectList(
    c: SqlCtx,
    selection: readonly NodeData[],
    projection: readonly ProjectionField[]
  ): string {
    return selection
      .map(
        (item, i) =>
          `${c.value(item)} AS ${qi(projection[i].col)}`
      )
      .join(", ")
  }

  function mutationSql(planned: Plan, p: AddParam): string {
    if ((planned.mode as string) !== "flat") {
      throw new Error("mutations do not support hydrate")
    }
    if (
      planned.orderBy.length > 0 ||
      planned.limit !== undefined ||
      planned.offset !== undefined
    ) {
      throw new Error(
        "mutations do not support orderBy/limit/offset"
      )
    }
    const base = tableName(planned.table)
    const aliases: Aliases = new Map()
    aliasSubTree(planned.root, base, aliases)
    const c = makeCtx(aliases, planned.root, p)
    const fields = tableFields(planned.table)
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
    if (planned.kind === "insert") {
      const rows = planned.rows ?? []
      if (planned.where.length > 0) {
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
        clauses.push(
          `INSERT INTO ${qi(base)} DEFAULT VALUES`
        )
      } else {
        const cols = keys.map(qi).join(", ")
        const vals = rows
          .map(
            row =>
              `(${keys
                .map(k =>
                  k in row ? p(row[k]) : "DEFAULT"
                )
                .join(", ")})`
          )
          .join(", ")
        clauses.push(
          `INSERT INTO ${qi(base)} (${cols}) VALUES ${vals}`
        )
      }
    } else if (planned.kind === "update") {
      const set = planned.set ?? {}
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
    if (
      planned.kind !== "insert" &&
      planned.where.length > 0
    ) {
      clauses.push(
        `WHERE ${planned.where.map(w => c.pred(w)).join(" AND ")}`
      )
    }
    if (planned.selection.length > 0) {
      clauses.push(
        `RETURNING ${selectList(c, planned.selection, planned.projection)}`
      )
    }
    return clauses.join("\n")
  }

  function querySql(planned: Plan, p: AddParam): string {
    const base = tableName(planned.table)
    const aliases: Aliases = new Map()
    aliasSubTree(planned.root, base, aliases)
    const c = makeCtx(aliases, planned.root, p)
    const list =
      planned.selection.length > 0
        ? selectList(
            c,
            planned.selection,
            planned.projection
          )
        : `${qi(base)}.*`
    const clauses = [
      `SELECT ${list}`,
      `FROM ${qi(base)} ${qi(base)}${renderJoins(aliases, planned.root)}`
    ]
    if (planned.where.length > 0) {
      clauses.push(
        `WHERE ${planned.where.map(w => c.pred(w)).join(" AND ")}`
      )
    }
    if (planned.orderBy.length > 0) {
      clauses.push(
        `ORDER BY ${planned.orderBy
          .map(
            o =>
              `${c.value(o.ref)} ${o.direction.toUpperCase()}`
          )
          .join(", ")}`
      )
    }
    if (planned.limit !== undefined) {
      clauses.push(
        `LIMIT ${p(bound(planned.limit, "limit"))}`
      )
    }
    if (planned.offset !== undefined) {
      clauses.push(
        `OFFSET ${p(bound(planned.offset, "offset"))}`
      )
    }
    return clauses.join("\n")
  }

  return {
    dialect,
    compile(ctx) {
      const params: unknown[] = []
      const p: AddParam = value => {
        params.push(value)
        return param(params.length)
      }
      const planned = plan(ctx)
      const sql =
        planned.kind !== undefined
          ? mutationSql(planned, p)
          : querySql(planned, p)
      return {
        dialect,
        sql,
        params,
        projection: planned.projection
      }
    }
  }
}

/** The ready-made Postgres compiler: default packs, `$n` params. */
export const postgres: Compiler = makeCompiler({
  dialect: "postgres"
})

export function toSQL(
  ctx: StatementContext
): CompiledQuery {
  return postgres.compile(ctx)
}
