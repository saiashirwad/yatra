import {
  _enum,
  array,
  type GetColumnType,
  type IsNullable,
  number,
  string,
  uuid,
} from "./columns";
import { oneToMany, oneToOne } from "./relations";
import type {
  DefaultRelations,
  FieldsRecord,
  Relation,
  RelationKind,
  RelationsRecord,
} from "./types";
import type { Clean } from "./utils";

type TableCallback<
  Fields extends FieldsRecord,
  Relations extends RelationsRecord,
> = (fields: Fields) => { relations: Relations };

type NullableFields<
  Fields = FieldsRecord,
> = {
  -readonly [
    k in keyof Fields as IsNullable<Fields[k]> extends true ? k
      : never
  ]?: GetColumnType<Fields[k]>;
};

type NonNullableFields<Fields = FieldsRecord> = {
  -readonly [
    k in keyof Fields as IsNullable<Fields[k]> extends false ? k
      : never
  ]: GetColumnType<Fields[k]>;
};

type HandleRelation<
  Ref extends Relation["ref"],
  Kind extends RelationKind,
> = Kind extends "one-to-one" ?
    | InstanceType<ReturnType<Relation["ref"]>>
    | MakeObject<
      InstanceType<ReturnType<Relation["ref"]>>["fields"]
    >
  : Relation["kind"] extends "many-to-one" | "one-to-many" ? Array<
      | InstanceType<ReturnType<Relation["ref"]>>
      | Record<string, any>
    >
  : never;

type MakeObject<
  Fields = FieldsRecord,
  Relations extends RelationsRecord = DefaultRelations,
  Nullable = NullableFields<Fields>,
  NonNullable = NonNullableFields<Fields>,
  Rels = {
    [k in keyof Relations]?: Relations[k]["kind"] extends "one-to-one" ?
        | InstanceType<ReturnType<Relations[k]["ref"]>>
        | MakeObject<
          InstanceType<ReturnType<Relations[k]["ref"]>>["fields"]
        >
      : Relations[k]["kind"] extends "many-to-one" | "one-to-many" ? Array<
          | InstanceType<ReturnType<Relations[k]["ref"]>>
          | Record<string, any>
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
  & { name: TableName; fields: Fields; relations: Relations }
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

class User extends Table(
  "user",
  {
    id: uuid().primaryKey(),
    name: string().default("no name").unique(),
    tags: array(_enum(["hi", "there"])).nullable(),
    type: _enum(["admin", "user"]),
  },
  (fields) => ({
    relations: { books: oneToMany(fields, () => Book).build() },
  }),
) {}

const book = new Book({
  id: "wa",
  price: 23,
  description: "asdf",
  authorId: "asdf",
  // author: {},
});

const user = new User({
  type: "user",
  id: "asdf",
  name: "asdf",
  tags: [],
  books: [
    book,
    {
      description: "wtf",
      id: "asdf",
      price: 2,
    },
  ],
});

console.log(user);

// const something = [5, 1, 2, 3];
// something.sort();
// console.log(something);

// const author = book.relations.author
// @ts-ignore
// const lol = Reflect.construct(author.ref(), ["init"])
