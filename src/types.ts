import type { Column } from "./columns/column";
import type { IsNullable } from "./columns/properties";
import type { Clean } from "./utils";

export type FieldsRecord = Record<
  string,
  Column<any, any>
>;

export type TableConstructor<F> = new(
  ...args: any[]
) => { fields: F };

export type InferColumn<C> = C extends Column<any, infer T>
  ? IsNullable<C> extends true ? T | null : T
  : never;

export type InferFields<CR extends Record<string, Column<any, any>>> = {
  [k in keyof CR]: InferColumn<CR[k]>;
};

export type NullableFields<
  Fields = FieldsRecord,
> = {
  -readonly [
    k in keyof Fields as IsNullable<
      Fields[k]
    > extends true ? k
      : never
  ]?: InferColumn<Fields[k]>;
};

export type NonNullableFields<Fields = FieldsRecord> = {
  -readonly [
    k in keyof Fields as IsNullable<
      Fields[k]
    > extends false ? k
      : never
  ]: InferColumn<Fields[k]>;
};

export type MakeTableObject<
  Fields = FieldsRecord,
  Nullable = NullableFields<Fields>,
  NonNullable = NonNullableFields<Fields>,
> = Clean<Nullable & NonNullable>;

export const TableName = Symbol.for("Yatra/Table/Name");
export const TableFields = Symbol.for("Yatra/Table/Fields");

export type TableInstance<
  TableName extends string,
  Fields extends FieldsRecord,
> = {
  [TableName]: TableName;
  [TableFields]: Fields;
} & MakeTableObject<Fields>;

export type TableType<
  TableName extends string,
  Fields extends FieldsRecord,
> = {
  new(
    args: MakeTableObject<Fields>,
  ): TableInstance<TableName, Fields>;
};
