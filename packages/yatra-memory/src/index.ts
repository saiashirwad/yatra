import {
  hydrateRows,
  plan,
  planScope,
  projectionOf,
  resolveJoin,
  tableFields,
  tableName,
  type AggData,
  type ExprData,
  type LitData,
  type Mode,
  type NodeData,
  type NoMutation,
  type Plan,
  type PlanJoin,
  type PlanNode,
  type PredData,
  type ProjectionField,
  type QueryContext,
  type RelData,
  type Row,
  type StatementResult,
  type Tableish
} from "yatra"
/**
 * Tables as plain arrays, keyed by table name. Many-to-many join tables
 * live under their join-table name, with columns named by the relation
 * metadata (`joinSourceCol` / `joinDestCol`, e.g. `"author.id"` becomes
 * `author_id`). A missing table reads as an empty array; insert
 * creates it.
 */
export type DataSet = Record<
  string,
  Record<string, unknown>[]
>
type RowValue = Record<string, unknown>
/** One joined tuple: chain path (`""` = root) → row, or null on a failed LEFT JOIN. */
type Tuple = Record<string, RowValue | null>
// --- join matching (keys resolved by the plan) ---
function findMatches(
  join: PlanJoin,
  parentRow: RowValue,
  data: DataSet,
  destTable: Tableish
): RowValue[] {
  const destRows = data[tableName(destTable)] ?? []
  if (join.kind === "m2m") {
    const jtRows = data[join.joinTable] ?? []
    const v = parentRow[join.sourceField]
    if (v == null) return []
    return destRows.filter(d => {
      const dv = d[join.destinationField]
      return (
        dv != null &&
        jtRows.some(
          jt =>
            jt[join.joinSourceCol] === v &&
            jt[join.joinDestCol] === dv
        )
      )
    })
  }
  const v = parentRow[join.sourceCol]
  if (v == null) return []
  return destRows.filter(d => d[join.destCol] === v)
}
// LEFT JOIN expansion: every tuple gets every tree path, null-filled.
function expandNode(
  node: PlanNode,
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
        ? findMatches(
            child.join!,
            parentRow,
            data,
            child.table
          )
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
    case "lit":
      return d.value
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
function evalExpr(tuple: Tuple, e: ExprData): unknown {
  switch (e.op) {
    case "lower": {
      const v = evalValue(tuple, e.args[0])
      return v == null ? null : String(v).toLowerCase()
    }
    case "mul": {
      const a = evalValue(tuple, e.args[0])
      const b = evalValue(tuple, e.args[1])
      return a == null || b == null
        ? null
        : Number(a) * Number(b)
    }
    default:
      throw new Error(
        `no eval handler for expr op '${e.op}' (backend 'memory')`
      )
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
  const sub = (d: NodeData): boolean | null => {
    if (d.kind !== "pred") {
      throw new Error("Expected a predicate")
    }
    return evalPred(tuple, d, data)
  }
  const [a0, a1] = p.args
  switch (p.op) {
    case "eq": {
      const x = evalValue(tuple, a0)
      const y = evalValue(tuple, a1)
      return x == null || y == null ? null : x === y
    }
    case "ne": {
      const x = evalValue(tuple, a0)
      const y = evalValue(tuple, a1)
      return x == null || y == null ? null : x !== y
    }
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const x = evalValue(tuple, a0) as any
      const y = evalValue(tuple, a1) as any
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
      const x = evalValue(tuple, a0)
      const y = evalValue(tuple, a1)
      if (x == null || y == null) return null
      return likeRegex(String(y), p.op === "ilike").test(
        String(x)
      )
    }
    case "in": {
      const x = evalValue(tuple, a0)
      if (x == null) return null
      const values = (a1 as LitData)
        .value as readonly unknown[]
      return values.some(v => v === x)
    }
    case "isNull":
      return evalValue(tuple, a0) == null
    case "isNotNull":
      return evalValue(tuple, a0) != null
    case "exists": {
      const rel = p.args[0] as RelData
      const join = resolveJoin(rel.relation)
      if (join.kind === "m2m") {
        throw new Error(
          "whereExists over many-to-many relations is not supported yet"
        )
      }
      const parentRow =
        tuple[rel.chain.slice(0, -1).join(".")]
      if (!parentRow) return false
      let matches = findMatches(
        join,
        parentRow,
        data,
        rel.relation.destinationTable
      )
      for (const sp of p.args.slice(1)) {
        matches = matches.filter(
          m =>
            evalPred({ "": m }, sp as PredData, data) ===
            true
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
    default:
      throw new Error(
        `no eval handler for pred op '${p.op}' (backend 'memory')`
      )
  }
}
// --- aggregations (correlated to the tuple's root row) ---
function evalAgg(
  rootRow: RowValue | null,
  spec: AggData,
  data: DataSet
): unknown {
  const join = resolveJoin(spec.relation)
  if (join.kind === "m2m") {
    throw new Error(
      "jsonAgg/count over many-to-many relations is not supported yet"
    )
  }
  const matches = rootRow
    ? findMatches(
        join,
        rootRow,
        data,
        spec.relation.destinationTable
      )
    : []
  if (spec.aggKind === "count") {
    return matches.length
  }
  if (spec.aggKind !== "array") {
    throw new Error(
      `no eval handler for agg kind '${spec.aggKind}' (backend 'memory')`
    )
  }
  const subRoot = planScope(
    spec.relation.destinationTable,
    spec.items
  )
  const subProj = projectionOf(spec.items, "hydrate")
  const seen = new Set<string>()
  const out: RowValue[] = []
  for (const m of matches) {
    for (const t of expandNode(
      subRoot,
      "",
      [{ "": m }],
      data
    )) {
      const obj = projectRow(t, spec.items, subProj, data)
      const key = JSON.stringify(obj)
      if (!seen.has(key)) {
        seen.add(key)
        out.push(obj)
      }
    }
  }
  return out
}
// --- projection (keys come from the plan's descriptor) ---
function evalItem(
  tuple: Tuple,
  d: NodeData,
  data: DataSet
): unknown {
  switch (d.kind) {
    case "col":
    case "lit":
    case "expr":
      return evalValue(tuple, d)
    case "as":
      return d.target.kind === "agg"
        ? evalAgg(tuple[""] ?? null, d.target, data)
        : evalValue(tuple, d.target)
    case "agg":
      return evalAgg(tuple[""] ?? null, d, data)
    default:
      throw new Error(
        `Item of kind '${d.kind}' is not selectable`
      )
  }
}
function projectRow(
  tuple: Tuple,
  selection: readonly NodeData[],
  projection: readonly ProjectionField[],
  data: DataSet
): RowValue {
  const row: RowValue = {}
  for (let i = 0; i < selection.length; i++) {
    row[projection[i].col] = evalItem(
      tuple,
      selection[i],
      data
    )
  }
  return row
}
/** limit/offset are inert `lit` nodes — interpreters validate them. */
function bound(
  node: LitData | undefined,
  what: string
): number | undefined {
  if (node === undefined) return undefined
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
// --- queries ---
function runQuery(
  planned: Plan,
  ctx: QueryContext<any, any, any, any>,
  data: DataSet
): unknown {
  let tuples = expandNode(
    planned.root,
    "",
    (data[tableName(planned.table)] ?? []).map(r => ({
      "": r
    })),
    data
  )
  if (planned.where.length > 0) {
    tuples = tuples.filter(t =>
      planned.where.every(
        w => evalPred(t, w, data) === true
      )
    )
  }
  if (planned.orderBy.length > 0) {
    const orders = planned.orderBy
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
  const start = bound(planned.offset, "offset") ?? 0
  const limitN = bound(planned.limit, "limit")
  const end =
    limitN !== undefined ? start + limitN : undefined
  tuples = tuples.slice(start, end)
  const rows =
    planned.selection.length > 0
      ? tuples.map(t =>
          projectRow(
            t,
            planned.selection,
            planned.projection,
            data
          )
        )
      : tuples.map(t => ({ ...t[""] }))
  if (
    planned.mode === "hydrate" &&
    planned.selection.length > 0
  ) {
    return hydrateRows(
      ctx as QueryContext<any, "hydrate", any>,
      rows,
      planned.projection
    )
  }
  return rows
}
// --- mutations ---
function runMutation(
  planned: Plan,
  data: DataSet
): unknown {
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
  const table = (data[base] ??= [])
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
  let affected: RowValue[]
  if (planned.kind === "insert") {
    const rows = planned.rows ?? []
    if (planned.where.length > 0) {
      throw new Error("insert does not take where")
    }
    if (rows.length === 0) {
      throw new Error("insert needs at least one row")
    }
    for (const row of rows) checkKeys(Object.keys(row))
    // No DEFAULT/AUTOINCREMENT synthesis: rows land as given.
    affected = rows.map(r => ({ ...r }))
    table.push(...affected)
  } else if (planned.kind === "update") {
    const set = planned.set ?? {}
    const keys = Object.keys(set)
    if (keys.length === 0) {
      throw new Error(
        "update needs at least one column to set"
      )
    }
    checkKeys(keys)
    affected = table.filter(row =>
      planned.where.every(
        w => evalPred({ "": row }, w, data) === true
      )
    )
    for (const row of affected) Object.assign(row, set)
  } else {
    const matched = new Set(
      table.filter(row =>
        planned.where.every(
          w => evalPred({ "": row }, w, data) === true
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
  if (planned.selection.length === 0) {
    return undefined
  }
  return affected.map(row =>
    projectRow(
      { "": row },
      planned.selection,
      planned.projection,
      data
    )
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
  const planned = plan(ctx)
  const out =
    planned.kind !== undefined
      ? runMutation(planned, data)
      : runQuery(planned, ctx, data)
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
