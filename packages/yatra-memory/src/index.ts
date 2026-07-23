import {
  buildRegistry,
  defaultPacks,
  hydrateRows,
  plan,
  planScope,
  projectionOf,
  resolveJoin,
  tableFields,
  tableName,
  type EvalCtx,
  type EvalScope,
  type LitData,
  type Mode,
  type NodeData,
  type NoMutation,
  type OpPack,
  type Plan,
  type PlanJoin,
  type PlanNode,
  type ProjectionField,
  type QueryContext,
  type Registry,
  type Relation,
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

export interface Evaluator {
  eval<
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[],
    X
  >(
    ctx: QueryContext<T, M, Items, X>,
    data: DataSet
  ): StatementResult<QueryContext<T, M, Items, X>>
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
        planned.kind !== undefined
          ? runMutation(registry, planned, data)
          : runQuery(registry, planned, ctx, data)
      return out as StatementResult<typeof ctx>
    }
  }
}

/** Eval services for one scope (root query or a sub-scope). */
function makeCtx(
  registry: Registry,
  tuple: Tuple,
  data: DataSet
): EvalCtx {
  const ctx: EvalCtx = {
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
          "jsonAgg/count/whereExists over many-to-many relations is not supported yet"
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
        collect(items) {
          const subRoot = planScope(
            relation.destinationTable,
            items
          )
          const subProj = projectionOf(items, "hydrate")
          const seen = new Set<string>()
          const out: RowValue[] = []
          for (const m of matches()) {
            for (const t of expandNode(
              subRoot,
              "",
              [{ "": m }],
              data
            )) {
              const obj = projectRow(
                registry,
                t,
                items,
                subProj,
                data
              )
              const key = JSON.stringify(obj)
              if (!seen.has(key)) {
                seen.add(key)
                out.push(obj)
              }
            }
          }
          return out
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
  data: DataSet
): RowValue {
  const c = makeCtx(registry, tuple, data)
  const row: RowValue = {}
  for (let i = 0; i < selection.length; i++) {
    row[projection[i].col] = c.value(selection[i])
  }
  return row
}

// --- queries ---
function runQuery(
  registry: Registry,
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
    tuples = tuples.filter(t => {
      const c = makeCtx(registry, t, data)
      return planned.where.every(w => c.pred(w) === true)
    })
  }
  if (planned.orderBy.length > 0) {
    const orders = planned.orderBy
    tuples = [...tuples].sort((a, b) => {
      const ca = makeCtx(registry, a, data)
      const cb = makeCtx(registry, b, data)
      for (const o of orders) {
        const va = ca.value(o.ref) as any
        const vb = cb.value(o.ref) as any
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
            registry,
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
  registry: Registry,
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
  const matchesWhere = (row: RowValue) => {
    const c = makeCtx(registry, { "": row }, data)
    return planned.where.every(w => c.pred(w) === true)
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
    affected = table.filter(matchesWhere)
    for (const row of affected) Object.assign(row, set)
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
  X
>(
  ctx: QueryContext<T, M, Items, X>,
  data: DataSet
): StatementResult<QueryContext<T, M, Items, X>> {
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
