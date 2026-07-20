import {
  accessor,
  type Accessor,
  type CheckItems,
  type MergeAll,
  type Mode,
  type OrderRef,
  type PredRef,
  type RequireTuple
} from "./ref.ts"
import type {
  AnyMutationExtra,
  InsertExtra
} from "./mutation.ts"
import type { InferColumn } from "./table.ts"
import type {
  Clean,
  Tableish,
  TableishFields
} from "./utils.ts"
export interface QueryContext<
  T extends Tableish,
  M extends Mode = "flat",
  Items extends readonly unknown[] = readonly [],
  X = {}
> {
  readonly table: T
  readonly mode: M
  readonly selection: Items
  readonly where: readonly PredRef[]
  readonly orderBy: readonly OrderRef[]
  readonly limit?: number
  readonly offset?: number
  /** phantom carrier for statement extras (InsertExtra & co.) */
  readonly x?: X
  // mutation payload (runtime side of X; absent on plain queries)
  readonly kind?: "insert" | "update" | "delete"
  readonly rows?: readonly Record<string, unknown>[]
  readonly set?: Record<string, unknown>
}
/**
 * Step gate: when X matches Forbidden the ctx must also carry an
 * impossible brand, so the offending pipe step fails to typecheck.
 */
type StepGate<
  X,
  Forbidden,
  Msg extends string
> = X extends Forbidden ? Record<Msg, never> : unknown
/** Queries only: rejects insert/update/delete contexts. */
export type NoMutation<X, Msg extends string> = StepGate<
  X,
  AnyMutationExtra,
  Msg
>
/** Inserts reject where; updates/deletes allow it. */
type NoInsert<X, Msg extends string> = StepGate<
  X,
  InsertExtra,
  Msg
>
export function query<T extends Tableish>(
  table: T
): QueryContext<T> {
  return {
    table,
    mode: "flat",
    selection: [],
    where: [],
    orderBy: []
  }
}
export function select<
  T extends Tableish,
  const NewItems extends readonly unknown[]
>(
  fn: (
    t: Accessor<T>
  ) => CheckItems<NewItems> & RequireTuple<NewItems>
): <M extends Mode, Items extends readonly unknown[], X>(
  ctx: QueryContext<T, M, Items, X>
) => QueryContext<
  T,
  M,
  readonly [...Items, ...NewItems],
  X
> {
  return (ctx => ({
    ...ctx,
    selection: [
      ...ctx.selection,
      ...(fn(accessor(ctx.table)) as unknown as NewItems)
    ]
  })) as <
    M extends Mode,
    Items extends readonly unknown[],
    X
  >(
    ctx: QueryContext<T, M, Items, X>
  ) => QueryContext<
    T,
    M,
    readonly [...Items, ...NewItems],
    X
  >
}
export function where<T extends Tableish>(
  fn: (t: Accessor<T>) => PredRef | readonly PredRef[]
): <M extends Mode, Items extends readonly unknown[], X>(
  ctx: QueryContext<T, M, Items, X> &
    NoInsert<X, "insert does not take where">
) => QueryContext<T, M, Items, X> {
  return (ctx => {
    const p = fn(accessor(ctx.table))
    return {
      ...ctx,
      where: [
        ...ctx.where,
        ...(Array.isArray(p) ? p : [p])
      ] as readonly PredRef[]
    }
  }) as <
    M extends Mode,
    Items extends readonly unknown[],
    X
  >(
    ctx: QueryContext<T, M, Items, X> &
      NoInsert<X, "insert does not take where">
  ) => QueryContext<T, M, Items, X>
}
export function orderBy<T extends Tableish>(
  fn: (t: Accessor<T>) => OrderRef | readonly OrderRef[]
): <M extends Mode, Items extends readonly unknown[], X>(
  ctx: QueryContext<T, M, Items, X> &
    NoMutation<X, "mutations do not support orderBy">
) => QueryContext<T, M, Items, X> {
  return (ctx => {
    const o = fn(accessor(ctx.table))
    return {
      ...ctx,
      orderBy: [
        ...ctx.orderBy,
        ...(Array.isArray(o) ? o : [o])
      ] as readonly OrderRef[]
    }
  }) as <
    M extends Mode,
    Items extends readonly unknown[],
    X
  >(
    ctx: QueryContext<T, M, Items, X> &
      NoMutation<X, "mutations do not support orderBy">
  ) => QueryContext<T, M, Items, X>
}
export function hydrate<
  T extends Tableish,
  Items extends readonly unknown[],
  X
>(
  ctx: QueryContext<T, "flat", Items, X> &
    NoMutation<X, "mutations do not support hydrate">
): QueryContext<T, "hydrate", Items, X> {
  return { ...ctx, mode: "hydrate" }
}
export function limit<const N extends number>(n: N) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("limit must be a non-negative integer")
  }
  return <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[],
    X
  >(
    ctx: QueryContext<T, M, Items, X> &
      NoMutation<X, "mutations do not support limit">
  ): QueryContext<T, M, Items, X> => {
    return { ...ctx, limit: n }
  }
}
export function offset<const N extends number>(n: N) {
  if (!Number.isInteger(n) || n < 0) {
    throw new Error("offset must be a non-negative integer")
  }
  return <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[],
    X
  >(
    ctx: QueryContext<T, M, Items, X> &
      NoMutation<X, "mutations do not support offset">
  ): QueryContext<T, M, Items, X> => {
    return { ...ctx, offset: n }
  }
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
