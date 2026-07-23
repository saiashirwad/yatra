import {
  accessor,
  lit,
  needData,
  selectionKey,
  type CheckItems,
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
import { shapeItems } from "./ops.ts"
import type {
  Assignment,
  StatementKind
} from "./statement.ts"
import type { InferColumn } from "./table.ts"
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
    order: []
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
/** Every column of the table as a result row (SELECT t.* shape). */
export type TableRow<T extends Tableish> = Clean<{
  [K in keyof TableishFields<T> & string]: InferColumn<
    TableishFields<T>[K]
  >
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
