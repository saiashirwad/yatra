import {
  dataOf,
  flatAlias,
  hydrateRows,
  info,
  ManyToManyRelation,
  tableFields,
  tableName,
  type AggData,
  type ExprData,
  type Mode,
  type NodeData,
  type NoMutation,
  type OrderData,
  type PredData,
  type QueryContext,
  type Relation,
  type RelData,
  type Row,
  type StatementResult,
  type Tableish
} from "yatra"
/**
 * Tables as plain arrays, keyed by table name. Many-to-many join tables
 * live under their join-table name, with columns named like the SQL
 * compiler expects: `sourceKey.replace(".", "_")` (e.g. `"author.id"`
 * becomes `author_id`). A missing table reads as an empty array; insert
 * creates it.
 */
export type DataSet = Record<
  string,
  Record<string, unknown>[]
>
type RowValue = Record<string, unknown>
/** One joined tuple: chain path (`""` = root) → row, or null on a failed LEFT JOIN. */
type Tuple = Record<string, RowValue | null>
// --- join tree (same shape as compile.ts) ---
interface TreeNode {
  table: Tableish
  name?: string
  relation?: Relation<any, any>
  children: Map<string, TreeNode>
}
const makeRoot = (table: Tableish): TreeNode => ({
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
        relation,
        table: relation.destinationTable,
        children: new Map()
      }
      node.children.set(seg, child)
    }
    node = child
  }
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
        // the relation is matched in the subquery, not joined —
        // only its parent chain joins at this level
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
// --- join matching ---
function joinColumns(
  rel: { foreignKey: unknown; referencedKey?: unknown },
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
function findMatches(
  rel: Relation<any, any>,
  parentRow: RowValue,
  data: DataSet
): RowValue[] {
  const destRows =
    data[tableName(rel.destinationTable)] ?? []
  if (rel instanceof ManyToManyRelation) {
    const jtRows = data[rel.joinTable] ?? []
    const srcField = rel.sourceKey.split(".")[1]!
    const dstField = rel.destinationKey.split(".")[1]!
    const srcJT = rel.sourceKey.replace(".", "_")
    const dstJT = rel.destinationKey.replace(".", "_")
    const v = parentRow[srcField]
    if (v == null) return []
    return destRows.filter(d => {
      const dv = d[dstField]
      return (
        dv != null &&
        jtRows.some(
          jt => jt[srcJT] === v && jt[dstJT] === dv
        )
      )
    })
  }
  const [srcCol, dstCol] = joinColumns(
    rel as any,
    tableName(rel.destinationTable)
  )
  const v = parentRow[srcCol]
  if (v == null) return []
  return destRows.filter(d => d[dstCol] === v)
}
// LEFT JOIN expansion: every tuple gets every tree path, null-filled.
function expandNode(
  node: TreeNode,
  path: string,
  tuples: Tuple[],
  data: DataSet
): Tuple[] {
  for (const [seg, child] of node.children) {
    const childPath = path === "" ? seg : `${path}.${seg}`
    const next: Tuple[] = []
    for (const t of tuples) {
      const parentRow = t[path]
      const matches = parentRow
        ? findMatches(child.relation!, parentRow, data)
        : []
      if (matches.length === 0) {
        next.push({ ...t, [childPath]: null })
      } else {
        for (const m of matches) {
          next.push({ ...t, [childPath]: m })
        }
      }
    }
    tuples = expandNode(child, childPath, next, data)
  }
  return tuples
}
// --- value evaluation (SQL null propagation) ---
function evalValue(tuple: Tuple, d: NodeData): unknown {
  switch (d.kind) {
    case "col": {
      const row = tuple[d.chain.join(".")]
      return row ? (row[d.key] ?? null) : null
    }
    case "expr":
      return evalExpr(tuple, d)
    case "as":
      return evalValue(tuple, d.target)
    default:
      throw new Error(
        `Cannot evaluate a node of kind '${d.kind}' as a value`
      )
  }
}
// Ops store arguments inconsistently: predicate args are node objects
// (RefData-branded), expression args are bare NodeData. Accept both.
const NODE_KINDS = new Set([
  "col",
  "expr",
  "as",
  "agg",
  "pred",
  "order",
  "rel"
])
function argData(a: unknown): NodeData | undefined {
  const d = dataOf(a)
  if (d) return d
  if (
    typeof a === "object" &&
    a !== null &&
    NODE_KINDS.has((a as NodeData).kind)
  ) {
    return a as NodeData
  }
  return undefined
}
function evalArg(tuple: Tuple, a: unknown): unknown {
  const d = argData(a)
  return d ? evalValue(tuple, d) : a
}
function evalExpr(tuple: Tuple, e: ExprData): unknown {
  switch (e.op) {
    case "lower": {
      const v = evalArg(tuple, e.args[0])
      return v == null ? null : String(v).toLowerCase()
    }
    case "mul": {
      const a = evalArg(tuple, e.args[0])
      const b = evalArg(tuple, e.args[1])
      return a == null || b == null
        ? null
        : Number(a) * Number(b)
    }
    default:
      throw new Error(`Unknown expression op '${e.op}'`)
  }
}
// --- predicates (SQL three-valued logic: null is not true) ---
function likeRegex(pattern: string, ci: boolean): RegExp {
  const re = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".")
  return new RegExp(`^${re}$`, ci ? "i" : "")
}
function evalPred(
  tuple: Tuple,
  p: PredData,
  data: DataSet
): boolean | null {
  const sub = (a: unknown): boolean | null => {
    const d = argData(a)
    if (!d || d.kind !== "pred") {
      throw new Error("Expected a predicate")
    }
    return evalPred(tuple, d, data)
  }
  const [a0, a1] = p.args
  switch (p.op) {
    case "eq": {
      const x = evalArg(tuple, a0)
      const y = evalArg(tuple, a1)
      return x == null || y == null ? null : x === y
    }
    case "ne": {
      const x = evalArg(tuple, a0)
      const y = evalArg(tuple, a1)
      return x == null || y == null ? null : x !== y
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const x = evalArg(tuple, a0) as any
      const y = evalArg(tuple, a1) as any
      if (x == null || y == null) return null
      return p.op === "gt"
        ? x > y
        : p.op === "gte"
          ? x >= y
          : p.op === "lt"
            ? x < y
            : x <= y
    }
    case "like":
    case "ilike": {
      const x = evalArg(tuple, a0)
      const y = evalArg(tuple, a1)
      if (x == null || y == null) return null
      return likeRegex(String(y), p.op === "ilike").test(
        String(x)
      )
    }
    case "in": {
      const x = evalArg(tuple, a0)
      if (x == null) return null
      return (a1 as readonly unknown[]).some(v => v === x)
    }
    case "isNull":
      return evalArg(tuple, a0) == null
    case "isNotNull":
      return evalArg(tuple, a0) != null
    case "exists": {
      const rel = p.args[0] as RelData
      if (rel.relation instanceof ManyToManyRelation) {
        throw new Error(
          "whereExists over many-to-many relations is not supported yet"
        )
      }
      const parentRow =
        tuple[rel.chain.slice(0, -1).join(".")]
      if (!parentRow) return false
      let matches = findMatches(
        rel.relation,
        parentRow,
        data
      )
      for (const sp of p.args.slice(1)) {
        const d = argData(sp) as PredData
        matches = matches.filter(
          m => evalPred({ "": m }, d, data) === true
        )
      }
      return matches.length > 0
    }
    case "and": {
      let sawNull = false
      for (const a of p.args) {
        const v = sub(a)
        if (v === false) return false
        if (v === null) sawNull = true
      }
      return sawNull ? null : true
    }
    case "or": {
      let sawNull = false
      for (const a of p.args) {
        const v = sub(a)
        if (v === true) return true
        if (v === null) sawNull = true
      }
      return sawNull ? null : false
    }
    case "not": {
      const v = sub(a0)
      return v === null ? null : !v
    }
  }
}
// --- aggregations (correlated to the tuple's root row) ---
function evalAgg(
  rootRow: RowValue | null,
  spec: AggData,
  data: DataSet
): unknown {
  const relation = spec.relation
  if (relation instanceof ManyToManyRelation) {
    throw new Error(
      "jsonAgg/count over many-to-many relations is not supported yet"
    )
  }
  const matches = rootRow
    ? findMatches(relation, rootRow, data)
    : []
  if (spec.aggKind === "count") {
    return matches.length
  }
  const subRoot = makeRoot(relation.destinationTable)
  const chains: Array<readonly string[]> = []
  for (const item of spec.items) {
    const d = dataOf(item)
    if (d) collectChains(d, chains)
  }
  for (const chain of chains) ensureChain(subRoot, chain)
  const seen = new Set<string>()
  const out: RowValue[] = []
  for (const m of matches) {
    for (const t of expandNode(
      subRoot,
      "",
      [{ "": m }],
      data
    )) {
      const obj = projectRow(t, spec.items, "hydrate", data)
      const key = JSON.stringify(obj)
      if (!seen.has(key)) {
        seen.add(key)
        out.push(obj)
      }
    }
  }
  return out
}
// --- projection (alias rules mirrored from compile.ts) ---
function projectItem(
  tuple: Tuple,
  d: NodeData,
  mode: Mode,
  data: DataSet
): [key: string, value: unknown] {
  switch (d.kind) {
    case "col": {
      const dotted = [...d.chain, d.key].join(".")
      const key =
        d.chain.length > 0
          ? mode === "hydrate"
            ? flatAlias(dotted)
            : dotted
          : d.key
      return [key, evalValue(tuple, d)]
    }
    case "as":
      return [
        d.alias,
        d.target.kind === "agg"
          ? evalAgg(tuple[""] ?? null, d.target, data)
          : evalValue(tuple, d.target)
      ]
    case "agg":
      return [d.key, evalAgg(tuple[""] ?? null, d, data)]
    default:
      throw new Error(
        `Item of kind '${d.kind}' is not selectable`
      )
  }
}
function projectRow(
  tuple: Tuple,
  items: readonly unknown[],
  mode: Mode,
  data: DataSet
): RowValue {
  const row: RowValue = {}
  for (const item of items) {
    const d = dataOf(item)
    if (!d) {
      throw new Error(
        `Invalid selection item: ${String(item)}`
      )
    }
    const [key, value] = projectItem(tuple, d, mode, data)
    row[key] = value
  }
  return row
}
// --- queries ---
function runQuery(
  ctx: QueryContext<any, any, any, any>,
  data: DataSet
): unknown {
  const root = makeRoot(ctx.table)
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
  for (const chain of chains) ensureChain(root, chain)
  let tuples = expandNode(
    root,
    "",
    (data[tableName(ctx.table)] ?? []).map(r => ({
      "": r
    })),
    data
  )
  if (ctx.where.length > 0) {
    tuples = tuples.filter(t =>
      ctx.where.every(
        w =>
          evalPred(t, dataOf(w) as PredData, data) === true
      )
    )
  }
  if (ctx.orderBy.length > 0) {
    const orders = ctx.orderBy.map(
      o => dataOf(o) as OrderData
    )
    tuples = [...tuples].sort((a, b) => {
      for (const o of orders) {
        const va = evalValue(a, o.ref) as any
        const vb = evalValue(b, o.ref) as any
        let cmp =
          va == null && vb == null
            ? 0
            : va == null
              ? 1 // nulls sort last (postgres default for ASC)
              : vb == null
                ? -1
                : va < vb
                  ? -1
                  : va > vb
                    ? 1
                    : 0
        if (o.direction === "desc") cmp = -cmp
        if (cmp !== 0) return cmp
      }
      return 0
    })
  }
  const start = ctx.offset ?? 0
  const end =
    ctx.limit !== undefined ? start + ctx.limit : undefined
  tuples = tuples.slice(start, end)
  const rows =
    ctx.selection.length > 0
      ? tuples.map(t =>
          projectRow(t, ctx.selection, ctx.mode, data)
        )
      : tuples.map(t => ({ ...t[""] }))
  if (ctx.mode === "hydrate" && ctx.selection.length > 0) {
    return hydrateRows(
      ctx as QueryContext<any, "hydrate", any>,
      rows
    )
  }
  return rows
}
// --- mutations ---
function runMutation(
  ctx: QueryContext<any, any, any, any>,
  data: DataSet
): unknown {
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
  const table = (data[base] ??= [])
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
  let affected: RowValue[]
  if (ctx.kind === "insert") {
    const rows = ctx.rows ?? []
    if (ctx.where.length > 0) {
      throw new Error("insert does not take where")
    }
    if (rows.length === 0) {
      throw new Error("insert needs at least one row")
    }
    for (const row of rows) checkKeys(Object.keys(row))
    // No DEFAULT/AUTOINCREMENT synthesis: rows land as given.
    affected = rows.map(r => ({ ...r }))
    table.push(...affected)
  } else if (ctx.kind === "update") {
    const set = ctx.set ?? {}
    const keys = Object.keys(set)
    if (keys.length === 0) {
      throw new Error(
        "update needs at least one column to set"
      )
    }
    checkKeys(keys)
    affected = table.filter(row =>
      ctx.where.every(
        w =>
          evalPred(
            { "": row },
            dataOf(w) as PredData,
            data
          ) === true
      )
    )
    for (const row of affected) Object.assign(row, set)
  } else {
    const matched = new Set(
      table.filter(row =>
        ctx.where.every(
          w =>
            evalPred(
              { "": row },
              dataOf(w) as PredData,
              data
            ) === true
        )
      )
    )
    affected = [...matched]
    table.splice(
      0,
      table.length,
      ...table.filter(row => !matched.has(row))
    )
  }
  if (ctx.selection.length === 0) {
    return undefined
  }
  return affected.map(row =>
    projectRow({ "": row }, ctx.selection, "flat", data)
  )
}
/**
 * Execute a query/mutation context against plain arrays — the IR
 * interpreter, no SQL involved. Synchronous.
 */
export function evalQuery<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[],
  X
>(
  ctx: QueryContext<T, M, Items, X>,
  data: DataSet
): StatementResult<QueryContext<T, M, Items, X>> {
  const out =
    "kind" in ctx
      ? runMutation(ctx, data)
      : runQuery(ctx, data)
  return out as StatementResult<
    QueryContext<T, M, Items, X>
  >
}
/**
 * Terminal pipe step — uncalled. Turns the context into a
 * data-awaiting function, so the dataset comes after the pipe:
 * `pipe(Author, query, ..., runMemory)(data)`. The piped part is a
 * reusable, data-independent query: run it against many datasets.
 */
export function runMemory<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[],
  X
>(
  ctx: QueryContext<T, M, Items, X>
): (
  data: DataSet
) => StatementResult<QueryContext<T, M, Items, X>> {
  return data => evalQuery(ctx, data)
}
/** First matching row, or null. Queries only, like `runOne`. */
export function runOneMemory<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[],
  X
>(
  ctx: QueryContext<T, M, Items, X> &
    NoMutation<
      X,
      "runOneMemory is only for queries — use runMemory for mutations"
    >
): (
  data: DataSet
) => Row<QueryContext<T, M, Items, X>> | null {
  return data => {
    const rows = evalQuery(ctx, data) as unknown as Row<
      QueryContext<T, M, Items, X>
    >[]
    return rows[0] ?? null
  }
}
