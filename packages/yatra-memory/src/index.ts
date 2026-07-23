import {
  buildRegistry,
  Default,
  DefaultValue,
  hydrateRows,
  litBound,
  plan,
  planScope,
  projectionOf,
  resolveJoin,
  setopCanonicalOrder,
  setopOrderKey,
  tableFields,
  tableName,
  validateGroup,
  type EvalCtx,
  type EvalScope,
  type Mode,
  type NodeData,
  type OpPack,
  type OrderData,
  type Plan,
  type PlanJoin,
  type PlanNode,
  type ProjectionField,
  type QueryContext,
  type Registry,
  type Relation,
  type Row,
  type StatementKind,
  type StatementResult,
  type Tableish
} from "yatra"
import { defaultPacks } from "yatra-ops"
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

export interface Evaluator {
  eval<
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[],
    K extends StatementKind
  >(
    ctx: QueryContext<T, M, Items, K>,
    data: DataSet
  ): StatementResult<QueryContext<T, M, Items, K>>
}

export interface EvaluatorConfig {
  readonly packs?: readonly OpPack[]
  readonly overrides?: readonly OpPack[]
}

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

/**
 * Assemble an in-memory evaluator from op packs — the same packs a
 * SQL compiler is built from, reading their `eval` facets. The shell
 * owns joins, filtering, ordering, projection, and mutations; every
 * op computes through the registry.
 */
export function makeEvaluator(
  config: EvaluatorConfig = {}
): Evaluator {
  const registry = buildRegistry(
    config.packs ?? defaultPacks,
    config.overrides ?? []
  )
  return {
    eval(ctx, data) {
      const planned = plan(
        ctx as QueryContext<any, any, any, any>
      )
      const out =
        planned.kind !== "select"
          ? runMutation(registry, planned, data)
          : runQuery(registry, planned, data)
      return out as StatementResult<typeof ctx>
    }
  }
}

/** Eval services for one scope (root query or a sub-scope). In a
 * grouped statement, `groupTuples` carries the group's tuples. */
function makeCtx(
  registry: Registry,
  tuple: Tuple,
  data: DataSet,
  groupTuples?: readonly Tuple[]
): EvalCtx {
  const ctx: EvalCtx = {
    ...(groupTuples
      ? {
          group: () =>
            groupTuples.map(t => makeCtx(registry, t, data))
        }
      : {}),
    value(node) {
      switch (node.kind) {
        case "col": {
          const row = tuple[node.chain.join(".")]
          return row ? (row[node.key] ?? null) : null
        }
        case "lit":
          return node.value
        case "expr": {
          const h = registry.expr[node.op]?.eval
          if (!h) {
            throw new Error(
              `no eval handler for expr op '${node.op}' (backend 'memory')`
            )
          }
          return h(node.args, ctx)
        }
        case "as":
          return ctx.value(node.target)
        case "agg": {
          const h = registry.agg[node.aggKind]?.eval
          if (!h) {
            throw new Error(
              `no eval handler for agg kind '${node.aggKind}' (backend 'memory')`
            )
          }
          return h(node, ctx)
        }
        default:
          throw new Error(
            `Cannot evaluate a node of kind '${node.kind}' as a value`
          )
      }
    },
    pred(node) {
      if (node.kind !== "pred") {
        throw new Error("Expected a predicate")
      }
      const h = registry.pred[node.op]?.eval
      if (!h) {
        throw new Error(
          `no eval handler for pred op '${node.op}' (backend 'memory')`
        )
      }
      return h(node.args, ctx)
    },
    scope(
      relation: Relation<any, any>,
      parentChain: readonly string[]
    ): EvalScope {
      const join = resolveJoin(relation)
      if (join.kind === "m2m") {
        throw new Error(
          "aggregations and exists-style subqueries over many-to-many relations are not supported yet"
        )
      }
      const parentRow = tuple[parentChain.join(".")]
      const matches = () =>
        parentRow
          ? findMatches(
              join,
              parentRow,
              data,
              relation.destinationTable
            )
          : []
      return {
        matches,
        pred: (row, node) =>
          makeCtx(registry, { "": row }, data).pred(node),
        collect(spec) {
          let ms = matches()
          for (const w of spec.where ?? []) {
            ms = ms.filter(
              m =>
                makeCtx(registry, { "": m }, data).pred(
                  w
                ) === true
            )
          }
          const subRoot = planScope(
            relation.destinationTable,
            [
              ...spec.items,
              ...(spec.where ?? []),
              ...(spec.order ?? [])
            ]
          )
          const subProj = projectionOf(
            spec.items,
            "hydrate"
          )
          const tuples = ms.flatMap(m =>
            expandNode(subRoot, "", [{ "": m }], data)
          )
          const orders = spec.order ?? []
          const limitN = litBound(spec.limit, "limit")
          if (orders.length > 0) {
            // explicit order: sort pre-projection, no dedupe
            const sorted = [...tuples].sort(
              compareTuples(registry, data, orders)
            )
            const sliced =
              limitN !== undefined
                ? sorted.slice(0, limitN)
                : sorted
            return sliced.map(t =>
              projectRow(
                registry,
                t,
                spec.items,
                subProj,
                data
              )
            )
          }
          // no explicit order: DISTINCT, ordered by the object itself
          // (jsonb ordering) — deterministic, matches the SQL facet
          const seen = new Set<string>()
          const objs: RowValue[] = []
          for (const t of tuples) {
            const obj = projectRow(
              registry,
              t,
              spec.items,
              subProj,
              data
            )
            const key = JSON.stringify(obj)
            if (seen.has(key)) continue
            seen.add(key)
            objs.push(obj)
          }
          objs.sort(compareJson)
          return limitN !== undefined
            ? objs.slice(0, limitN)
            : objs
        }
      }
    }
  }
  return ctx
}

// --- projection (keys come from the plan's descriptor) ---
function projectRow(
  registry: Registry,
  tuple: Tuple,
  selection: readonly NodeData[],
  projection: readonly ProjectionField[],
  data: DataSet,
  groupTuples?: readonly Tuple[]
): RowValue {
  const c = makeCtx(registry, tuple, data, groupTuples)
  const row: RowValue = {}
  for (let i = 0; i < selection.length; i++) {
    row[projection[i].col] = c.value(selection[i])
  }
  return row
}

/**
 * jsonb's total order (postgres): null < string < number < boolean <
 * array < object. Sub-shape collections without an explicit orderBy
 * sort by this, so both backends return the same deterministic order.
 */
function compareJson(a: unknown, b: unknown): number {
  const rank = (v: unknown): number =>
    v === null
      ? 0
      : typeof v === "string"
        ? 1
        : typeof v === "number"
          ? 2
          : typeof v === "boolean"
            ? 3
            : Array.isArray(v)
              ? 4
              : 5
  const ra = rank(a)
  const rb = rank(b)
  if (ra !== rb) return ra - rb
  if (a === null || b === null) return 0
  if (typeof a === "string" && typeof b === "string") {
    return a < b ? -1 : a > b ? 1 : 0
  }
  if (typeof a === "number" && typeof b === "number") {
    return a - b
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return a === b ? 0 : a ? 1 : -1
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      const c = compareJson(a[i], b[i])
      if (c !== 0) return c
    }
    return a.length - b.length
  }
  const ao = a as Record<string, unknown>
  const bo = b as Record<string, unknown>
  const ak = Object.keys(ao).sort()
  const bk = Object.keys(bo).sort()
  for (let i = 0; i < Math.min(ak.length, bk.length); i++) {
    const ka = ak[i]
    const kb = bk[i]
    // jsonb object keys: length first, then text
    const kc =
      ka.length - kb.length ||
      (ka < kb ? -1 : ka > kb ? 1 : 0)
    if (kc !== 0) return kc
    const vc = compareJson(ao[ka], bo[kb])
    if (vc !== 0) return vc
  }
  return ak.length - bk.length
}

/** nulls sort last for ASC (postgres default), first for DESC. */
function compareCtx(
  ca: EvalCtx,
  cb: EvalCtx,
  orders: readonly OrderData[]
): number {
  for (const o of orders) {
    const va = ca.value(o.ref) as any
    const vb = cb.value(o.ref) as any
    const cmp =
      va == null && vb == null
        ? 0
        : va == null
          ? 1
          : vb == null
            ? -1
            : va < vb
              ? -1
              : va > vb
                ? 1
                : 0
    if (cmp !== 0) {
      return o.direction === "desc" ? -cmp : cmp
    }
  }
  return 0
}
function compareTuples(
  registry: Registry,
  data: DataSet,
  orders: readonly OrderData[]
) {
  return (a: Tuple, b: Tuple): number =>
    compareCtx(
      makeCtx(registry, a, data),
      makeCtx(registry, b, data),
      orders
    )
}

// --- queries ---
/** Grouped evaluation: partition tuples, then having/order/slice/
 * project per group. Aggregate functions reduce over `EvalCtx.group`. */
function runGrouped(
  registry: Registry,
  planned: Plan,
  tuples: Tuple[],
  data: DataSet
): RowValue[] {
  const groups = new Map<string, Tuple[]>()
  if (planned.group.length === 0) {
    // no keys: the whole table is one group (bare aggregate select)
    groups.set("", tuples)
  } else {
    for (const t of tuples) {
      const c = makeCtx(registry, t, data)
      const k = JSON.stringify(
        planned.group.map(g => c.value(g))
      )
      const arr = groups.get(k)
      if (arr) arr.push(t)
      else groups.set(k, [t])
    }
  }
  let gs = [...groups.values()]
  if (planned.having.length > 0) {
    gs = gs.filter(g => {
      const c = makeCtx(registry, g[0] ?? {}, data, g)
      return planned.having.every(h => c.pred(h) === true)
    })
  }
  if (planned.order.length > 0) {
    const orders = planned.order
    gs = [...gs].sort((ga, gb) =>
      compareCtx(
        makeCtx(registry, ga[0] ?? {}, data, ga),
        makeCtx(registry, gb[0] ?? {}, data, gb),
        orders
      )
    )
  }
  return gs.map(g =>
    projectRow(
      registry,
      g[0] ?? {},
      planned.selection,
      planned.projection,
      data,
      g
    )
  )
}
/** A set operation: both sides evaluate as full queries; the op's
 * order/limit apply to the combined result. */
function runSetop(
  registry: Registry,
  planned: Plan,
  data: DataSet
): unknown {
  const so = planned.setop!
  const l = runQuery(registry, so.left, data) as RowValue[]
  const r = runQuery(registry, so.right, data) as RowValue[]
  const key = (row: RowValue) => JSON.stringify(row)
  let rows: RowValue[]
  if (so.op === "union") {
    const seen = new Set<string>()
    rows = [...l, ...r].filter(row => {
      const k = key(row)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  } else {
    const rKeys = new Set(r.map(key))
    const seen = new Set<string>()
    rows = l.filter(row => {
      const k = key(row)
      const keep =
        so.op === "intersect" ? rKeys.has(k) : !rKeys.has(k)
      if (!keep || seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  if (planned.order.length > 0) {
    rows = [...rows].sort((a, b) => {
      for (const o of planned.order) {
        const k = setopOrderKey(planned, o)
        const va = a[k] as any
        const vb = b[k] as any
        const cmp =
          va == null && vb == null
            ? 0
            : va == null
              ? 1
              : vb == null
                ? -1
                : va < vb
                  ? -1
                  : va > vb
                    ? 1
                    : 0
        if (cmp !== 0) {
          return o.direction === "desc" ? -cmp : cmp
        }
      }
      return 0
    })
  } else {
    const canonical = setopCanonicalOrder(planned)
    if (canonical !== undefined) {
      rows = [...rows].sort((a, b) => {
        for (const k of canonical) {
          const va = a[k] as any
          const vb = b[k] as any
          const cmp =
            va == null && vb == null
              ? 0
              : va == null
                ? 1
                : vb == null
                  ? -1
                  : va < vb
                    ? -1
                    : va > vb
                      ? 1
                      : 0
          if (cmp !== 0) return cmp
        }
        return 0
      })
    }
  }
  const start = litBound(planned.offset, "offset") ?? 0
  const limitN = litBound(planned.limit, "limit")
  const end =
    limitN !== undefined ? start + limitN : undefined
  rows = rows.slice(start, end)
  if (planned.mode === "hydrate") {
    return hydrateRows(
      planned.source.table,
      rows,
      planned.projection
    )
  }
  return rows
}
function runQuery(
  registry: Registry,
  planned: Plan,
  data: DataSet
): unknown {
  if (planned.setop) {
    return runSetop(registry, planned, data)
  }
  let tuples = expandNode(
    planned.root,
    "",
    (data[tableName(planned.source.table)] ?? []).map(
      r => ({
        "": r
      })
    ),
    data
  )
  const grouped = validateGroup(
    planned,
    op => registry.expr[op]?.aggregate === true
  )
  if (planned.where.length > 0) {
    tuples = tuples.filter(t => {
      const c = makeCtx(registry, t, data)
      return planned.where.every(w => c.pred(w) === true)
    })
  }
  let rows: RowValue[]
  if (grouped) {
    rows = runGrouped(registry, planned, tuples, data)
  } else {
    if (planned.order.length > 0) {
      tuples = [...tuples].sort(
        compareTuples(registry, data, planned.order)
      )
    }
    rows =
      planned.selection.length > 0
        ? tuples.map(t =>
            projectRow(
              registry,
              t,
              planned.selection,
              planned.projection,
              data
            )
          )
        : tuples.map(t => ({ ...t[""] }))
  }
  if (planned.distinct) {
    const seen = new Set<string>()
    rows = rows.filter(r => {
      const k = JSON.stringify(r)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }
  const start = litBound(planned.offset, "offset") ?? 0
  const limitN = litBound(planned.limit, "limit")
  const end =
    limitN !== undefined ? start + limitN : undefined
  rows = rows.slice(start, end)
  if (
    planned.mode === "hydrate" &&
    planned.selection.length > 0
  ) {
    return hydrateRows(
      planned.source.table,
      rows,
      planned.projection
    )
  }
  return rows
}

// --- mutations ---
/** dbDefault in memory: the column's declared default, else null
 * (no DEFAULT/AUTOINCREMENT synthesis beyond that). */
function columnDefault(
  table: Tableish,
  col: string
): unknown {
  const field = tableFields(table)[col] as unknown as
    | Record<symbol, unknown>
    | undefined
  return field?.[Default] ?? null
}
function runMutation(
  registry: Registry,
  planned: Plan,
  data: DataSet
): unknown {
  const base = tableName(planned.source.table)
  const table = (data[base] ??= [])
  const fields = tableFields(planned.source.table)
  const checkKeys = (keys: Iterable<string>) => {
    for (const k of keys) {
      if (!(k in fields)) {
        throw new Error(
          `Unknown column '${k}' for table '${base}'`
        )
      }
    }
  }
  const matchesWhere = (row: RowValue) => {
    const c = makeCtx(registry, { "": row }, data)
    return planned.where.every(w => c.pred(w) === true)
  }
  /** insert values are lits (or dbDefault) — expressions can't
   * reference a row that doesn't exist yet */
  const insertValue = (
    node: NodeData,
    col: string
  ): unknown => {
    if (node.kind !== "lit") {
      throw new Error("insert values must be plain values")
    }
    return node.value === DefaultValue
      ? columnDefault(planned.source.table, col)
      : node.value
  }
  let affected: RowValue[]
  if (planned.kind === "insert") {
    const rows = planned.rows ?? []
    if (rows.length === 0) {
      throw new Error("insert needs at least one row")
    }
    for (const row of rows) checkKeys(Object.keys(row))
    // No DEFAULT synthesis for absent keys: rows land as given.
    affected = rows.map(r =>
      Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          insertValue(v, k)
        ])
      )
    )
    table.push(...affected)
  } else if (planned.kind === "update") {
    const set = planned.set ?? []
    if (set.length === 0) {
      throw new Error(
        "update needs at least one column to set"
      )
    }
    checkKeys(set.map(a => a.col))
    affected = table.filter(matchesWhere)
    for (const row of affected) {
      const c = makeCtx(registry, { "": row }, data)
      for (const a of set) {
        row[a.col] =
          a.value.kind === "lit" &&
          a.value.value === DefaultValue
            ? columnDefault(planned.source.table, a.col)
            : c.value(a.value)
      }
    }
  } else {
    const matched = new Set(table.filter(matchesWhere))
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
      registry,
      { "": row },
      planned.selection,
      planned.projection,
      data
    )
  )
}

/** The standard evaluator: default packs, Postgres semantics. */
export const memory: Evaluator = makeEvaluator()

/**
 * Execute a query/mutation context against plain arrays — the IR
 * interpreter, no SQL involved. Synchronous.
 */
export function evalQuery<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[],
  K extends StatementKind
>(
  ctx: QueryContext<T, M, Items, K>,
  data: DataSet
): StatementResult<QueryContext<T, M, Items, K>> {
  return memory.eval(ctx, data)
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
  K extends StatementKind
>(
  ctx: QueryContext<T, M, Items, K>
): (
  data: DataSet
) => StatementResult<QueryContext<T, M, Items, K>> {
  return data => evalQuery(ctx, data)
}
/** First matching row, or null. Queries only, like `runOne`. */
export function runOneMemory<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[]
>(
  ctx: QueryContext<T, M, Items, "select">
): (
  data: DataSet
) => Row<QueryContext<T, M, Items, "select">> | null {
  return data => {
    const rows = evalQuery(ctx, data) as unknown as Row<
      QueryContext<T, M, Items, "select">
    >[]
    return rows[0] ?? null
  }
}
