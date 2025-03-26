import {
  type FieldsRecord,
  type MakeTableObject,
  TableFields,
  TableName,
  type TableType,
} from "./types";

export type GetTableFields<T> = T extends TableType<any, infer Fields> ? Fields
  : never;

export function Table<
  const TableName extends string,
  const Fields extends FieldsRecord,
>(
  tableName: TableName,
  fields: Fields,
): TableType<TableName, Fields> {
  class TableClass {
    public [TableName]: TableName = tableName;
    public [TableFields]: Fields = fields;

    constructor(
      args: MakeTableObject<Fields>,
    ) {
      if (typeof args === "object") {
        for (const key in args) {
          (this as any)[key] = (args as any)[key];
        }
      }
    }
  }
  return TableClass as TableType<
    TableName,
    Fields
  >;
}
