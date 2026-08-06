import { Column } from "./columns/column.ts"
import type { IsNullable } from "./columns/properties.ts"
import { Relation } from "./relation.ts"
import type { Clean, Tableish } from "./utils.ts"
export const TableFields = Symbol.for("Yatra/Table/Fields")
export const TableName = Symbol.for("Yatra/Table/Name")
export type FieldsRecord = Record<string, Column<any, any>>
export type TableType<
  Name extends string,
  Fields extends FieldsRecord
> = {
  new (
    args: MakeTableObject<Fields>
  ): TableInstance<Name, Fields>
  map<Result>(fn: (fields: Fields) => Result): Result
  fields: Fields
}
export type MakeTableObject<
  Fields = FieldsRecord,
  Nullable = NullableFields<Fields>,
  NonNullable = NonNullableFields<Fields>
> = Clean<Nullable & NonNullable>
export function Table<
  Name extends string,
  Args extends FieldsRecord
>(tableName: Name, fields: Args): TableType<Name, Args> {
  class TableClass {
    public static fields: Args = fields
    static map<Result>(fn: (fields: Args) => Result) {
      return fn(fields)
    }
    constructor(args: MakeTableObject<Args>) {
      if (typeof args === "object") {
        for (const key in args) {
          ;(this as any)[key] = (args as any)[key]
        }
      }
    }
  }
  ;(TableClass.prototype as any)[TableName] = tableName
  ;(TableClass.prototype as any)[TableFields] = fields
  return TableClass as TableType<Name, Args>
}
export function tableName<T extends Tableish>(
  table: T
): string {
  return table.prototype[TableName]
}
export function tableFields<T extends Tableish>(
  table: T
): FieldsRecord {
  return table.prototype[TableFields]
}
export interface TableInfo {
  name: string
  fields: FieldsRecord
  relations: Record<string, Relation<any, any>>
}
// Relations never change after class definition, so scan the prototype
// chain once per table class — plan building hits this per chain step.
const infoCache = new WeakMap<Tableish, TableInfo>()
export function info<T extends Tableish>(
  table: T
): TableInfo {
  const cached = infoCache.get(table)
  if (cached) return cached
  const relations: Record<string, Relation<any, any>> = {}
  for (const key of Reflect.ownKeys(table.prototype)) {
    const value = table.prototype[key]
    if (value instanceof Relation) {
      relations[key as string] = value
    }
  }
  const result = {
    name: tableName(table),
    fields: tableFields(table),
    relations
  }
  infoCache.set(table, result)
  return result
}
export type InferColumn<C> =
  C extends Column<any, infer T>
    ? IsNullable<C> extends true
      ? T | null
      : T
    : never
export type NullableFields<Fields = FieldsRecord> = {
  -readonly [k in keyof Fields as IsNullable<
    Fields[k]
  > extends true
    ? k
    : never]?: InferColumn<Fields[k]>
}
export type NonNullableFields<Fields = FieldsRecord> = {
  -readonly [k in keyof Fields as IsNullable<
    Fields[k]
  > extends false
    ? k
    : never]: InferColumn<Fields[k]>
}
export type TableInstance<
  Name extends string,
  Fields extends FieldsRecord
> = {
  [TableName]: Name
  [TableFields]: Fields
} & MakeTableObject<Fields>
