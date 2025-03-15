import {
  _enum,
  array,
  type Column,
  type GetColumnType,
  type IsNullable,
  number,
  string,
  uuid,
} from "./columns";
import type { Clean, Constructor } from "./utils";

export function member<
  Co extends Constructor,
  Instance extends InstanceType<Co>,
  K extends keyof Instance,
>(c: Co, key: K): Instance[K] {
  return new c()[key];
}

type FieldsRecord = Record<string, Column<any, any>>;
type RelationsRecord = Record<string, Relation>;
type DefaultRelations = Record<string, never>;

type TableConstructor<F> = new(...args: any[]) => { fields: F };

type ManyToOneRelation<Ref, VirtualField, ForeignKey> = {
  kind: "many-to-one";
  ref: Ref;
  virtualField: VirtualField;
  foreignKey: ForeignKey;
};
type OneToManyRelation<Ref> = { kind: "one-to-many"; ref: Ref };
type OneToOneRelation<Ref, VirtualField, ForeignKey> = {
  kind: "one-to-one";
  ref: Ref;
  virtualField: VirtualField;
  foreignKey: ForeignKey;
};

export type Relation =
  | ManyToOneRelation<any, any, any>
  | OneToManyRelation<any>
  | OneToOneRelation<any, any, any>;

class ManyToOneBuilder<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
> {
  private virtualField?: keyof Fields;
  private foreignKey?: keyof InstanceType<ReturnType<Ref>>["fields"];
  constructor(private fields: Fields, private ref: Ref) {}
  using<VF extends keyof Fields>(virtualField: VF) {
    this.virtualField = virtualField;
    return this;
  }
  references<
    FK extends keyof InstanceType<ReturnType<Ref>>["fields"],
  >(foreignKey: FK) {
    this.foreignKey = foreignKey;
    return this;
  }
  build(): ManyToOneRelation<
    Ref,
    keyof Fields,
    keyof InstanceType<ReturnType<Ref>>["fields"]
  > {
    if (!this.virtualField || !this.foreignKey) {
      throw new Error(
        "ManyToOne relation requires both virtualField and foreignKey",
      );
    }
    return {
      kind: "many-to-one",
      ref: this.ref,
      virtualField: this.virtualField,
      foreignKey: this.foreignKey,
    };
  }
}

class OneToManyBuilder<Ref extends () => any> {
  constructor(private ref: Ref) {}
  build(): OneToManyRelation<Ref> {
    return { kind: "one-to-many", ref: this.ref };
  }
}

class OneToOneBuilder<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
> {
  private virtualField?: keyof Fields;
  private foreignKey?: keyof InstanceType<ReturnType<Ref>>["fields"];
  constructor(private fields: Fields, private ref: Ref) {}
  using<VF extends keyof Fields>(virtualField: VF) {
    this.virtualField = virtualField;
    return this;
  }
  references<
    FK extends keyof InstanceType<ReturnType<Ref>>["fields"],
  >(foreignKey: FK) {
    this.foreignKey = foreignKey;
    return this;
  }
  build(): OneToOneRelation<
    Ref,
    keyof Fields,
    keyof InstanceType<ReturnType<Ref>>["fields"]
  > {
    if (!this.virtualField || !this.foreignKey) {
      throw new Error(
        "OneToOne relation requires both virtualField and foreignKey",
      );
    }
    return {
      kind: "one-to-one",
      ref: this.ref,
      virtualField: this.virtualField,
      foreignKey: this.foreignKey,
    };
  }
}

export function manyToOne<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
>(
  t: Fields,
  ref: Ref,
): ManyToOneBuilder<Fields, Ref> {
  return new ManyToOneBuilder(t, ref);
}

export function oneToMany<
  Fields extends FieldsRecord,
  Ref extends () => any,
>(
  t: Fields,
  ref: Ref,
): OneToManyBuilder<Ref> {
  return new OneToManyBuilder(ref);
}

export function oneToOne<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
>(
  t: Fields,
  ref: Ref,
): OneToOneBuilder<Fields, Ref> {
  return new OneToOneBuilder(t, ref);
}

type TableCallback<
  Fields extends FieldsRecord,
  Relations extends RelationsRecord,
> = (fields: Fields) => { relations: Relations };

type MakeObject<
  Fields = FieldsRecord,
  Relations extends RelationsRecord = DefaultRelations,
  Nullable = {
    -readonly [
      k in keyof Fields as IsNullable<Fields[k]> extends true ? k
        : never
    ]?: GetColumnType<Fields[k]>;
  },
  NonNullable = {
    -readonly [
      k in keyof Fields as IsNullable<Fields[k]> extends false ? k
        : never
    ]: GetColumnType<Fields[k]>;
  },
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

// const author = book.relations.author
// @ts-ignore
// const lol = Reflect.construct(author.ref(), ["init"])
