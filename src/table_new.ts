import type { Column } from "./columns/column";
import type { IsNullable } from "./columns/properties";
import type { FieldsRecord } from "./types";
import type { Clean } from "./utils";

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

export type Table<
  TableName extends string,
  Fields extends FieldsRecord,
> = {
  new(
    args: MakeTableObject<Fields>,
  ): {
    [TableName]: TableName;
    [TableFields]: Fields;
  } & MakeTableObject<Fields>;
};

export function Table<
  const TableName extends string,
  const Fields extends FieldsRecord,
>(
  tableName: TableName,
  fields: Fields,
): Table<TableName, Fields> {
  class TableClass {
    public [TableName]: TableName = tableName;
    public [TableFields]: Fields = fields;

    constructor(
      args: MakeTableObject<Fields>,
    ) {
      // if (callback) {
      //   const result = callback(fields);
      //   // this.relations = result.relations;
      // }
      if (typeof args === "object") {
        for (const key in args) {
          (this as any)[key] = (args as any)[key];
        }
      }
    }
  }
  return TableClass as Table<
    TableName,
    Fields
  >;
}
