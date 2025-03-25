import { _enum, array, type GetColumnType, type IsNullable, number, string, uuid } from "./columns";
import { oneToMany, oneToOne } from "./relations";
import type { DefaultRelations, FieldsRecord, RelationsRecord, TableCallback } from "./types";
import type { Clean } from "./utils";

/**
 * Type utilities using declare for phantom types
 */
export declare class TypeUtils<
  Fields extends FieldsRecord,
> {
  declare NullableFields: {
    -readonly [
      K in keyof Fields as IsNullable<Fields[K]> extends true ? K : never
    ]?: GetColumnType<Fields[K]>;
  };

  declare NonNullableFields: {
    -readonly [
      K in keyof Fields as IsNullable<Fields[K]> extends false ? K : never
    ]: GetColumnType<Fields[K]>;
  };
}

/**
 * Object type representation using declare for cleaner type definitions
 */
export declare class ObjectRepresentation<
  Fields extends FieldsRecord,
  Relations extends RelationsRecord = DefaultRelations,
> {
  declare NullableFields: TypeUtils<
    Fields
  >["NullableFields"];
  declare NonNullableFields: TypeUtils<
    Fields
  >["NonNullableFields"];

  declare RelationsRepresentation: Relations extends never ? never
    : {
      [K in keyof Relations]?: Relations[K]["kind"] extends "one-to-one" | "many-to-one" ?
          | InstanceType<ReturnType<Relations[K]["ref"]>>
          | MakeObject<
            InstanceType<
              ReturnType<Relations[K]["ref"]>
            >["fields"]
          >
        : Relations[K]["kind"] extends "many-to-many" | "one-to-many" ? Array<
            InstanceType<ReturnType<Relations[K]["ref"]>>
          >
        : never;
    };

  declare type: Clean<
    & this["NullableFields"]
    & this["NonNullableFields"]
    & this["RelationsRepresentation"]
  >;
}

type MakeObject<
  Fields extends FieldsRecord,
  Relations extends RelationsRecord = DefaultRelations,
> = ObjectRepresentation<
  Fields,
  Relations
>["type"];

/**
 * Table types with enhanced declare usage
 */
export declare class TableTypes<
  TableName extends string,
  Fields extends FieldsRecord,
  Relations extends RelationsRecord = DefaultRelations,
> {
  declare constructorArgs: MakeObject<Fields, Relations>;

  declare instance: {
    name: TableName;
    fields: Fields;
    relations: Relations;
  } & MakeObject<Fields>;

  declare tableType: {
    new(args: this["constructorArgs"]): this["instance"];
  };

  declare fnTableType: {
    name: TableName;
    fields: Fields;
  };
}

// Type aliases using declare for better type inference
declare type TableConstructorArgs<
  Fields extends FieldsRecord,
  Relations extends RelationsRecord,
> = TableTypes<
  string,
  Fields,
  Relations
>["constructorArgs"];

declare type TableInstance<
  TableName extends string,
  Fields extends FieldsRecord,
  Relations extends RelationsRecord,
> = TableTypes<
  TableName,
  Fields,
  Relations
>["instance"];

declare type Table<
  TableName extends string,
  Fields extends FieldsRecord,
  Relations extends RelationsRecord = DefaultRelations,
> = TableTypes<TableName, Fields, Relations>["tableType"];

declare type FnTable<
  TableName extends string,
  Fields extends FieldsRecord,
> = TableTypes<
  TableName,
  Fields
>["fnTableType"];

// Table function implementation
export function table<
  const TableName extends string,
  const Fields extends FieldsRecord,
>(
  name: TableName,
  fields: Fields,
): FnTable<
  TableName,
  { -readonly [K in keyof Fields]: Fields[K] }
> {
  return { name, fields };
}

// Table class constructor function
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

    // Phantom types using declare
    declare _tableName: TableName;
    declare _fieldsType: Fields;
    declare _relationsType: Relations;
    declare _objectType: MakeObject<Fields, Relations>;

    constructor(args: MakeObject<Fields, Relations>) {
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
  return TableClass as Table<TableName, Fields, Relations>;
}

// Example usage remains unchanged
const userTable = table("user", {
  id: string().primaryKey(),
  age: number(),
  tags: array(string()),
});

const tag = table("tag", {
  id: string().primaryKey(),
});

// Extended classes remain unchanged
class Book extends Table(
  "book",
  {
    id: uuid().primaryKey(),
    authorId: string(),
    description: string().default("what"),
    price: number().nullable(),
  },
  (fields) => ({
    relations: {
      author: oneToOne(fields, () => User).using("authorId")
        .references("id").build(),
    },
  }),
) {}

class Tag extends Table("tag", {
  id: uuid().primaryKey(),
}) {}

class User extends Table(
  "user",
  {
    id: uuid().primaryKey(),
    name: string().default("no name").unique(),
    type: _enum(["admin", "user"]),
  },
  (fields) => ({
    relations: {
      books: oneToMany(fields, () => Book).build(),
    },
    ha: {
      something: () => User,
    },
  }),
) {}

const book = new Book({
  id: "wa",
  price: 23,
  description: "asdf",
  authorId: "asdf",
});

const user = new User({
  type: "user",
  id: "asdf",
  name: "asdf",
  books: [book],
});
