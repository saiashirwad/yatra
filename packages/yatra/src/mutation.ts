import {
  type AutoIncrement,
  type Default,
  type Generated,
  type IsNullable
} from "./columns/properties.ts"
import {
  accessor,
  type Accessor,
  type CheckItems,
  type MergeAll
} from "./ref.ts"
import type { QueryContext } from "./query.ts"
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
type OptionalInsert<Fields extends FieldsRecord> = {
  [K in keyof Fields & string as IsNullable<
    Fields[K]
  > extends true
    ? K
    : HasDbValue<Fields[K]> extends true
      ? K
      : never]?: InferColumn<Fields[K]>
}
type RequiredInsert<Fields extends FieldsRecord> = {
  [K in keyof Fields & string as IsNullable<
    Fields[K]
  > extends true
    ? never
    : HasDbValue<Fields[K]> extends true
      ? never
      : K]: InferColumn<Fields[K]>
}
/** Row shape for insert: nullable and db-computed columns are optional. */
export type InsertInput<Fields extends FieldsRecord> =
  Clean<OptionalInsert<Fields> & RequiredInsert<Fields>>
/** Set shape for update: every column optional, settable to null. */
export type UpdateInput<Fields extends FieldsRecord> =
  Clean<{
    [K in keyof Fields & string]?: InferColumn<Fields[K]>
  }>
// --- contexts (a query context whose phantom X carries the payload) ---
export type MutationKind = "insert" | "update" | "delete"
export interface InsertExtra {
  readonly kind: "insert"
  readonly rows: readonly Record<string, unknown>[]
}
export interface UpdateExtra {
  readonly kind: "update"
  readonly set: Record<string, unknown>
}
export interface DeleteExtra {
  readonly kind: "delete"
}
export type InsertContext<
  T extends Tableish,
  Items extends readonly unknown[] = readonly []
> = QueryContext<T, "flat", Items, InsertExtra>
export type UpdateContext<
  T extends Tableish,
  Items extends readonly unknown[] = readonly []
> = QueryContext<T, "flat", Items, UpdateExtra>
export type DeleteContext<
  T extends Tableish,
  Items extends readonly unknown[] = readonly []
> = QueryContext<T, "flat", Items, DeleteExtra>
export type MutationContext<
  T extends Tableish = Tableish,
  Items extends readonly unknown[] = readonly []
> =
  | InsertContext<T, Items>
  | UpdateContext<T, Items>
  | DeleteContext<T, Items>
export type AnyMutationExtra =
  | InsertExtra
  | UpdateExtra
  | DeleteExtra
export type MutationResult<Ctx> =
  Ctx extends QueryContext<any, any, infer Items, infer X>
    ? X extends AnyMutationExtra
      ? Items extends readonly []
        ? void
        : MergeAll<"flat", Items>[]
      : never
    : never
// --- value validation (surfaces on the step's table argument) ---
type UnknownCols<
  T extends Tableish,
  Row
> = Row extends unknown
  ? Exclude<keyof Row, keyof TableishFields<T>>
  : never
type ValidInsert<T extends Tableish, Row> =
  UnknownCols<T, Row> extends never
    ? Row extends InsertInput<TableishFields<T>>
      ? unknown
      : {
          readonly "insert row does not fit this table": InsertInput<
            TableishFields<T>
          >
        }
    : {
        readonly "insert row has unknown columns": UnknownCols<
          T,
          Row
        >
      }
type ValidUpdate<T extends Tableish, S> =
  UnknownCols<T, S> extends never
    ? S extends UpdateInput<TableishFields<T>>
      ? unknown
      : {
          readonly "update values do not fit this table": UpdateInput<
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
    table,
    mode: "flat",
    selection: [],
    where: [],
    orderBy: [],
    kind: "insert",
    rows: (Array.isArray(rows)
      ? rows
      : [rows]) as readonly Record<string, unknown>[]
  })
}
export function update<S extends Record<string, unknown>>(
  set: S
) {
  return <T extends Tableish>(
    table: T & ValidUpdate<T, S>
  ): UpdateContext<T> => ({
    table,
    mode: "flat",
    selection: [],
    where: [],
    orderBy: [],
    kind: "update",
    set
  })
}
export function del<T extends Tableish>(
  table: T
): DeleteContext<T> {
  return {
    table,
    mode: "flat",
    selection: [],
    where: [],
    orderBy: [],
    kind: "delete"
  }
}
/** RETURNING clause: select's machinery, gated to mutation contexts. */
export function returning<
  T extends Tableish,
  const NewItems extends readonly unknown[]
>(
  fn: (t: Accessor<T>) => CheckItems<NewItems>
): <
  Items extends readonly unknown[],
  X extends AnyMutationExtra
>(
  ctx: QueryContext<T, "flat", Items, X>
) => QueryContext<
  T,
  "flat",
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
    Items extends readonly unknown[],
    X extends AnyMutationExtra
  >(
    ctx: QueryContext<T, "flat", Items, X>
  ) => QueryContext<
    T,
    "flat",
    readonly [...Items, ...NewItems],
    X
  >
}
