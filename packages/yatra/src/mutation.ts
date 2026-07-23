import {
  type AutoIncrement,
  type Default,
  type Generated,
  type IsNullable
} from "./columns/properties.ts"
import {
  accessor,
  dataOf,
  lit,
  needData,
  type CheckItems,
  type ColRef,
  type ColumnValue,
  type ExprRef,
  type QueryAccessor,
  type RequireTuple
} from "./ref.ts"
import type { Assignment, DbDefault } from "./statement.ts"
import {
  appendSelection,
  type QueryContext
} from "./query.ts"
import type { FieldsRecord, InferColumn } from "./table.ts"
import type {
  Clean,
  Tableish,
  TableishFields
} from "./utils.ts"
// --- input types ---
type HasDbValue<C> =
  C extends Default<any>
    ? true
    : C extends AutoIncrement
      ? true
      : C extends Generated<any>
        ? true
        : false
type OptionalInsert<
  T extends Tableish,
  Fields extends FieldsRecord = TableishFields<T>
> = {
  [K in keyof Fields & string as IsNullable<
    Fields[K]
  > extends true
    ? K
    : HasDbValue<Fields[K]> extends true
      ? K
      : never]?: ColumnValue<T, K>
}
type RequiredInsert<
  T extends Tableish,
  Fields extends FieldsRecord = TableishFields<T>
> = {
  [K in keyof Fields & string as IsNullable<
    Fields[K]
  > extends true
    ? never
    : HasDbValue<Fields[K]> extends true
      ? never
      : K]: ColumnValue<T, K>
}
/** Row shape for insert: nullable and db-computed columns are optional. */
export type InsertInput<T extends Tableish> = Clean<
  OptionalInsert<T> & RequiredInsert<T>
>
/**
 * Update-set values: a plain value, an expression over the row being
 * updated (via a module-level accessor: `mul(b.price, 2)`), or
 * `dbDefault` for the column's database default.
 */
export type SetValue<T extends Tableish, V> =
  | V
  | ColRef<V, any, any, T>
  | ExprRef<V, T>
  | DbDefault
/** Set shape for update: every column optional, values or expressions. */
export type UpdateInput<
  T extends Tableish,
  Fields extends FieldsRecord = TableishFields<T>
> = Clean<{
  [K in keyof Fields & string]?: SetValue<
    T,
    ColumnValue<T, K>
  >
}>
// --- contexts ---
export type InsertContext<
  T extends Tableish,
  Items extends readonly unknown[] = readonly []
> = QueryContext<T, "flat", Items, "insert">
export type UpdateContext<
  T extends Tableish,
  Items extends readonly unknown[] = readonly []
> = QueryContext<T, "flat", Items, "update">
export type DeleteContext<
  T extends Tableish,
  Items extends readonly unknown[] = readonly []
> = QueryContext<T, "flat", Items, "delete">
export type MutationContext<
  T extends Tableish = Tableish,
  Items extends readonly unknown[] = readonly []
> =
  | InsertContext<T, Items>
  | UpdateContext<T, Items>
  | DeleteContext<T, Items>
// --- value validation (surfaces on the step's table argument) ---
type UnknownCols<
  T extends Tableish,
  Row
> = Row extends unknown
  ? Exclude<keyof Row, keyof TableishFields<T>>
  : never
type ValidInsert<T extends Tableish, Row> =
  UnknownCols<T, Row> extends never
    ? Row extends InsertInput<T>
      ? unknown
      : {
          readonly "insert row does not fit this table": InsertInput<T>
        }
    : {
        readonly "insert row has unknown columns": UnknownCols<
          T,
          Row
        >
      }
type ValidUpdate<T extends Tableish, S> =
  UnknownCols<T, S> extends never
    ? S extends UpdateInput<T, TableishFields<T>>
      ? unknown
      : {
          readonly "update values do not fit this table": UpdateInput<
            T,
            TableishFields<T>
          >
        }
    : {
        readonly "update values have unknown columns": UnknownCols<
          T,
          S
        >
      }
type RowOf<R> = R extends readonly (infer One)[] ? One : R
// --- pipe steps ---
export function insert<
  R extends
    | Record<string, unknown>
    | readonly Record<string, unknown>[]
>(rows: R) {
  return <T extends Tableish>(
    table: T & ValidInsert<T, RowOf<R>>
  ): InsertContext<T> => ({
    kind: "insert",
    source: { kind: "table", table },
    mode: "flat",
    selection: [],
    where: [],
    order: [],
    rows: (Array.isArray(rows) ? rows : [rows]).map(row =>
      Object.fromEntries(
        Object.entries(row).map(([k, v]) => [k, lit(v)])
      )
    )
  })
}
/**
 * Update columns to plain values, or to expressions over the row
 * being updated via a module-level accessor:
 * `update({ price: mul(b.price, 2) })`.
 */
export function update<S extends Record<string, unknown>>(
  set: S
) {
  return <T extends Tableish>(
    table: T & ValidUpdate<T, S>
  ): UpdateContext<T> => ({
    kind: "update",
    source: { kind: "table", table },
    mode: "flat",
    selection: [],
    where: [],
    order: [],
    set: Object.entries(set).map(
      ([col, v]): Assignment => ({
        col,
        value: dataOf(v) ?? lit(v)
      })
    )
  })
}
export function del<T extends Tableish>(
  table: T
): DeleteContext<T> {
  return {
    kind: "delete",
    source: { kind: "table", table },
    mode: "flat",
    selection: [],
    where: [],
    order: []
  }
}
/** RETURNING clause: select's machinery, gated to mutation contexts. */
export function returning<
  T extends Tableish,
  const NewItems extends readonly unknown[]
>(
  fn: (
    t: QueryAccessor<T>
  ) => CheckItems<NewItems, T> & RequireTuple<NewItems>
): <
  Items extends readonly unknown[],
  K extends "insert" | "update" | "delete"
>(
  ctx: QueryContext<T, "flat", Items, K>
) => QueryContext<
  T,
  "flat",
  readonly [...Items, ...NewItems],
  K
> {
  return ((ctx: QueryContext<T, "flat", any, any>) => ({
    ...ctx,
    selection: appendSelection(
      ctx.selection,
      (
        fn(
          accessor(ctx.source.table)
        ) as unknown as NewItems
      ).map(needData)
    )
  })) as unknown as <
    Items extends readonly unknown[],
    K extends "insert" | "update" | "delete"
  >(
    ctx: QueryContext<T, "flat", Items, K>
  ) => QueryContext<
    T,
    "flat",
    readonly [...Items, ...NewItems],
    K
  >
}
