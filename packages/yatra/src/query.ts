import {
  accessor,
  dataOf,
  lit,
  needData,
  selectionKey,
  type AliasData,
  type CheckItems,
  type ColRef,
  type ColumnValue,
  type ExprRef,
  type MergeAll,
  type Mode,
  type NodeData,
  type OrderRef,
  type PredRef,
  type QueryAccessor,
  type RequireTuple,
  type Selectable,
  type ShapeRef,
  type ShapeRow
} from "./ref.ts"
import type {
  Assignment,
  StatementData,
  StatementKind
} from "./statement.ts"
import type {
  Clean,
  Tableish,
  TableishFields
} from "./utils.ts"

/**
 * The pipe context: a statement, narrowed at the type level. `T`, `M`,
 * and `Items` are phantoms carried on the corresponding fields; `K` is
 * a real discriminant — step legality (insert rejects where, mutations
 * reject orderBy) is a plain constraint on it. Structurally a
 * {@link StatementData}; declared standalone because `selection` holds
 * typed refs at build time, not bare nodes.
 */
export interface QueryContext<
  T extends Tableish = Tableish,
  M extends Mode = "flat",
  Items extends readonly unknown[] = readonly [],
  K extends StatementKind = StatementKind
> {
  readonly kind: K
  readonly source: {
    readonly kind: "table"
    readonly table: T
  }
  readonly mode: M
  readonly selection: Items
  readonly where: readonly NodeData[]
  readonly order: readonly NodeData[]
  readonly limit?: NodeData
  readonly offset?: NodeData
  readonly materialize?: boolean
  readonly group: readonly NodeData[]
  readonly having: readonly NodeData[]
  readonly distinct?: boolean
  readonly setop?: {
    readonly op: "union" | "intersect" | "except"
    readonly left: StatementData
    readonly right: StatementData
  }
  readonly rows?: readonly Record<string, NodeData>[]
  readonly set?: readonly Assignment[]
}

export function query<T extends Tableish>(
  table: T
): QueryContext<T, "flat", readonly [], "select"> {
  return {
    kind: "select",
    source: { kind: "table", table },
    mode: "flat",
    selection: [],
    where: [],
    order: [],
    group: [],
    having: []
  }
}
/**
 * Append selection items, dropping any whose path is already selected —
 * two fragments contributing `t.id` produce one column, not two.
 */
export function appendSelection(
  selection: readonly NodeData[],
  items: readonly NodeData[]
): NodeData[] {
  const seen = new Set(selection.map(selectionKey))
  const out = [...selection]
  for (const item of items) {
    const key = selectionKey(item)
    if (key !== undefined) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    out.push(item)
  }
  return out
}
// --- object shapes (docs/shapes.md) ---
/** The inherent result key of a node, if it has one. */
function inherentKey(d: NodeData): string | undefined {
  switch (d.kind) {
    case "col":
      return d.key
    case "as":
      return d.alias
    case "agg":
      return d.key
    default:
      return undefined
  }
}
/**
 * Desugar an object shape to selection nodes: the key is the alias.
 * Entries whose node already produces that key pass through; the rest
 * get an `as` wrapper.
 */
export function shapeItems(
  shape: Record<string, unknown>
): NodeData[] {
  return Object.entries(shape).map(([k, v]) => {
    const d = dataOf(v)
    if (!d) {
      throw new Error(
        `Shape entry '${k}' is not a yatra node`
      )
    }
    if (inherentKey(d) === k) return d
    const aliased: AliasData = {
      kind: "as",
      target: d,
      alias: k
    }
    return aliased
  })
}
export function select<
  T extends Tableish,
  const NewItems extends readonly unknown[]
>(
  fn: (
    t: QueryAccessor<T>
  ) => CheckItems<NewItems, T> & RequireTuple<NewItems>
): <
  M extends Mode,
  Items extends readonly unknown[],
  K extends StatementKind
>(
  ctx: QueryContext<T, M, Items, K>
) => QueryContext<T, M, readonly [...Items, ...NewItems], K>
/** Object-shape select: the key is the alias; `many`/`one` nest
 * sub-shapes (docs/shapes.md). Shape ⇒ nested result — no hydrate
 * step needed. */
export function select<
  T extends Tableish,
  const S extends Record<string, Selectable<T>>
>(
  fn: (t: QueryAccessor<T>) => S
): <
  M extends Mode,
  Items extends readonly unknown[],
  K extends StatementKind
>(
  ctx: QueryContext<T, M, Items, K>
) => QueryContext<
  T,
  M,
  readonly [...Items, ShapeRef<ShapeRow<S>>],
  K
>
export function select<T extends Tableish>(
  fn: (t: QueryAccessor<T>) => unknown
): (ctx: QueryContext<T, any, any, any>) => unknown {
  return (ctx: QueryContext<T, any, any, any>) => {
    const out = fn(accessor(ctx.source.table)) as
      | readonly unknown[]
      | Record<string, unknown>
    // Array.isArray doesn't narrow readonly arrays out of a union
    const items = Array.isArray(out)
      ? (out as unknown[]).map(needData)
      : shapeItems(out as Record<string, unknown>)
    return {
      ...ctx,
      selection: appendSelection(ctx.selection, items)
    }
  }
}
/** Conditional composition stays inside the pipe: falsy array entries
 * are dropped (`where(t => [min && gte(t.price, min)])`). */
type Falsy = false | null | undefined
export function where<T extends Tableish>(
  fn: (
    t: QueryAccessor<T>
  ) => PredRef<T> | readonly (PredRef<T> | Falsy)[]
): <
  M extends Mode,
  Items extends readonly unknown[],
  K extends "select" | "update" | "delete"
>(
  ctx: QueryContext<T, M, Items, K>
) => QueryContext<T, M, Items, K> {
  return (ctx => {
    const p = fn(accessor(ctx.source.table))
    return {
      ...ctx,
      where: [
        ...ctx.where,
        ...(Array.isArray(p) ? p : [p])
          .filter(Boolean)
          .map(needData)
      ]
    }
  }) as <
    M extends Mode,
    Items extends readonly unknown[],
    K extends "select" | "update" | "delete"
  >(
    ctx: QueryContext<T, M, Items, K>
  ) => QueryContext<T, M, Items, K>
}
export function orderBy<T extends Tableish>(
  fn: (
    t: QueryAccessor<T>
  ) => OrderRef<T> | readonly (OrderRef<T> | Falsy)[]
): <M extends Mode, Items extends readonly unknown[]>(
  ctx: QueryContext<T, M, Items, "select">
) => QueryContext<T, M, Items, "select"> {
  return (ctx => {
    const o = fn(accessor(ctx.source.table))
    return {
      ...ctx,
      order: [
        ...ctx.order,
        ...(Array.isArray(o) ? o : [o])
          .filter(Boolean)
          .map(needData)
      ]
    }
  }) as <M extends Mode, Items extends readonly unknown[]>(
    ctx: QueryContext<T, M, Items, "select">
  ) => QueryContext<T, M, Items, "select">
}
export function hydrate<
  T extends Tableish,
  Items extends readonly unknown[]
>(
  ctx: QueryContext<T, "flat", Items, "select">
): QueryContext<T, "hydrate", Items, "select"> {
  return { ...ctx, mode: "hydrate" }
}
export function limit<const N extends number>(n: N) {
  return <
    T extends Tableish,
    Items extends readonly unknown[]
  >(
    ctx: QueryContext<T, "flat", Items, "select">
  ): QueryContext<T, "flat", Items, "select"> => ({
    ...ctx,
    limit: lit(n)
  })
}
export function offset<const N extends number>(n: N) {
  return <
    T extends Tableish,
    Items extends readonly unknown[]
  >(
    ctx: QueryContext<T, "flat", Items, "select">
  ): QueryContext<T, "flat", Items, "select"> => ({
    ...ctx,
    offset: lit(n)
  })
}
/** Hint: prefer materializing this statement (CTE / temp / client
 * cache) when it appears as an intermediate. Backends may ignore it. */
export function materialize<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[]
>(
  ctx: QueryContext<T, M, Items, "select">
): QueryContext<T, M, Items, "select"> {
  return { ...ctx, materialize: true }
}
/**
 * GROUP BY: changes row cardinality — each group is one row. Appends
 * like `where`, so fragments compose. Selections on a grouped
 * statement must be group keys or aggregates (`count()`, `sum(x)`, …).
 */
export function group<T extends Tableish>(
  fn: (
    t: QueryAccessor<T>
  ) =>
    | ColRef<any, any, any, T>
    | ExprRef<any, T>
    | readonly (
        | ColRef<any, any, any, T>
        | ExprRef<any, T>
      )[]
): <M extends Mode, Items extends readonly unknown[]>(
  ctx: QueryContext<T, M, Items, "select">
) => QueryContext<T, M, Items, "select"> {
  return (ctx => {
    const g = fn(accessor(ctx.source.table))
    return {
      ...ctx,
      group: [
        ...ctx.group,
        ...(Array.isArray(g) ? g : [g]).map(needData)
      ]
    }
  }) as <M extends Mode, Items extends readonly unknown[]>(
    ctx: QueryContext<T, M, Items, "select">
  ) => QueryContext<T, M, Items, "select">
}
/** Predicates over groups — same append semantics as `where`. */
export function having<T extends Tableish>(
  fn: (
    t: QueryAccessor<T>
  ) => PredRef<T> | readonly (PredRef<T> | Falsy)[]
): <M extends Mode, Items extends readonly unknown[]>(
  ctx: QueryContext<T, M, Items, "select">
) => QueryContext<T, M, Items, "select"> {
  return (ctx => {
    const p = fn(accessor(ctx.source.table))
    return {
      ...ctx,
      having: [
        ...ctx.having,
        ...(Array.isArray(p) ? p : [p])
          .filter(Boolean)
          .map(needData)
      ]
    }
  }) as <M extends Mode, Items extends readonly unknown[]>(
    ctx: QueryContext<T, M, Items, "select">
  ) => QueryContext<T, M, Items, "select">
}
/** SELECT DISTINCT — one field on the statement, not an emulation
 * with `group`. */
export function distinct<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[]
>(
  ctx: QueryContext<T, M, Items, "select">
): QueryContext<T, M, Items, "select"> {
  return { ...ctx, distinct: true }
}
/**
 * Set ops (docs/shapes.md): relational-algebra closure over query
 * values. The piped statement is the left side; order/limit/offset
 * after the op apply to the combined result; filtering belongs inside
 * each side. `recursive` is fixpoint over union
 * (docs/query-values-and-scopes.md).
 */
const setopStep =
  (op: "union" | "intersect" | "except") =>
  <R extends QueryContext<any, any, any, "select">>(
    right: R
  ) =>
  <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[]
  >(
    left: QueryContext<T, M, Items, "select">
  ): QueryContext<T, M, Items, "select"> =>
    ({
      ...left,
      where: [],
      order: [],
      group: [],
      having: [],
      limit: undefined,
      offset: undefined,
      distinct: undefined,
      materialize: undefined,
      setop: { op, left, right }
    }) as QueryContext<T, M, Items, "select">
export const union = setopStep("union")
export const intersect = setopStep("intersect")
export const except = setopStep("except")
/** Every column of the table as a result row (SELECT t.* shape). */
export type TableRow<T extends Tableish> = Clean<{
  [K in keyof TableishFields<T> & string]: ColumnValue<T, K>
}>
export type Row<Ctx> =
  Ctx extends QueryContext<
    infer T,
    infer M,
    infer Items,
    any
  >
    ? Items extends readonly []
      ? TableRow<T>
      : MergeAll<M, Items>
    : never
export type Result<Ctx> =
  Ctx extends QueryContext<any, any, any, any>
    ? Row<Ctx>[]
    : never
