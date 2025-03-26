import type { GetColumnType } from "./columns/base-columns";
import type { IsNullable } from "./columns/properties";
import type {
  DefaultRelations,
  FieldsRecord,
  RelationsRecord,
  TableCallback,
} from "./types";
import type { Clean } from "./utils";

type NullableFields<
  Fields = FieldsRecord,
> = {
  -readonly [
    k in keyof Fields as IsNullable<
      Fields[k]
    > extends true ? k
      : never
  ]?: GetColumnType<Fields[k]>;
};

type NonNullableFields<Fields = FieldsRecord> = {
  -readonly [
    k in keyof Fields as IsNullable<
      Fields[k]
    > extends false ? k
      : never
  ]: GetColumnType<Fields[k]>;
};

type MakeObject<
  Fields = FieldsRecord,
  Relations extends RelationsRecord = DefaultRelations,
  Nullable = NullableFields<Fields>,
  NonNullable = NonNullableFields<Fields>,
  Rels = Relations extends never ? never : {
    [k in keyof Relations]?: Relations[k]["kind"] extends
      "one-to-one" | "many-to-one" ?
        | InstanceType<
          ReturnType<Relations[k]["ref"]>
        >
        | MakeObject<
          InstanceType<
            ReturnType<Relations[k]["ref"]>
          >["fields"]
        >
      : Relations[k]["kind"] extends "many-to-many" | "one-to-many" ? Array<
          InstanceType<
            ReturnType<Relations[k]["ref"]>
          >
        >
      : never;
  },
> = Clean<Nullable & NonNullable & Rels>;

type TableConstructorArgs<
  Fields extends FieldsRecord,
  Relations extends RelationsRecord,
> = MakeObject<Fields, Relations>;

type TableInstance<
  TableName extends string,
  Fields extends FieldsRecord,
  Relations extends RelationsRecord,
> =
  & {
    name: TableName;
    fields: Fields;
    relations: Relations;
  }
  & MakeObject<Fields>;

type Table<
  TableName extends string,
  Fields extends FieldsRecord,
  Relations extends RelationsRecord = DefaultRelations,
> = {
  new(
    args: TableConstructorArgs<Fields, Relations>,
  ): TableInstance<TableName, Fields, Relations>;
};

export function Table<
  const TableName extends string,
  const Fields extends FieldsRecord,
  const Relations extends RelationsRecord = DefaultRelations,
>(
  tableName: TableName,
  fields: Fields,
  callback?: TableCallback<Fields, Relations>,
): Table<TableName, Fields, Relations> {
  class TableClass {
    public name: TableName = tableName;
    public fields: Fields = fields;
    public relations: Relations = {} as Relations;

    constructor(
      args: MakeObject<Fields, Relations>,
    ) {
      if (callback) {
        const result = callback(fields);
        this.relations = result.relations;
      }
      if (typeof args === "object") {
        for (const key in args) {
          (this as any)[key] = (args as any)[key];
        }
      }
    }
  }
  return TableClass as Table<
    TableName,
    Fields,
    Relations
  >;
}
