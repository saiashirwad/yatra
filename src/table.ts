import { Column } from "./columns/column";
import type { IsNullable } from "./columns/properties";
import { type Pipeable, pipeArguments } from "./pipeable";
import type { Clean } from "./utils";

export const TableFields = Symbol.for("Yatra/Table/Fields");
export const TableName = Symbol.for("Yatra/Table/Name");

export function Table<
  TableName extends string,
  Args extends FieldsRecord,
>(
  tableName: TableName,
  fields: Args,
): TableType<TableName, Args> {
  class TableClass {
    public [TableName]: TableName = tableName;
    public [TableFields]: Args = fields;

    constructor(
      args: MakeTableObject<Args>,
    ) {
      if (typeof args === "object") {
        for (const key in args) {
          const value = (args as any)[key];
          if (value instanceof Column) {
            console.log(key, value);
          }
          (this as any)[key] = (args as any)[key];
        }
      }
    }
  }

  return TableClass as any as TableType<
    TableName,
    Args
  >;
}

export type FieldsRecord = Record<
  string,
  Column<any, any>
>;

export type GetTableFields<T> = T extends TableType<any, infer Fields> ? Fields
  : never;

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

export type TableInstance<
  TableName extends string,
  Fields extends FieldsRecord,
> =
  & {
    [TableName]: TableName;
    [TableFields]: Fields;
  }
  & MakeTableObject<Fields>;

export interface TableType<
  TableName extends string,
  Fields extends FieldsRecord,
> {
  new(
    args: MakeTableObject<Fields>,
  ): TableInstance<TableName, Fields>;
}

export type RelationTableConstructor = new(
  args: any,
) => TableInstance<string, FieldsRecord>;

export type ExtractFields<T> = T extends TableType<any, infer F> ? F
  : never;

export type ExtractKeys<T> = keyof ExtractFields<T>;
export type ExtractTableName<T> = T extends TableType<infer N, any> ? N : never;
