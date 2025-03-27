import { Column } from "./columns/column";
import type { IsNullable } from "./columns/properties";
import { type Pipeable, pipeArguments } from "./pipeable";
import type { Clean } from "./utils";

export const SourceTable = Symbol.for("Yatra/Relation/SourceTable");
export const DestinationTable = Symbol.for("Yatra/Relation/DestinationTable");
export const TableFields = Symbol.for("Yatra/Table/Fields");

export class Relation<
  Source extends RelationTableConstructor,
  Destination extends RelationTableConstructor,
> implements Pipeable {
  public [SourceTable]: Source;
  public [DestinationTable]: Destination;

  constructor(
    source: () => Source,
    destination: () => Destination,
  ) {
    this[SourceTable] = source();
    this[DestinationTable] = destination();
  }

  pipe(...fns: Array<Function>) {
    return pipeArguments(
      this,
      arguments,
    );
  }

  get sourceTable() {
    return this[SourceTable];
  }

  get destinationTable() {
    return this[DestinationTable];
  }
}

export type FieldsRecord = Record<
  string,
  Column<any, any> | Relation<any, any>
>;

export function Table<
  const TableName extends string,
  const Args extends FieldsRecord,
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
          if (value instanceof Relation) {
            console.log(key, value);
          }
          if (value instanceof Column) {
            console.log(key, value);
          }
          (this as any)[key] = (args as any)[key];
        }
      }
    }
  }
  return TableClass as TableType<
    TableName,
    Args
  >;
}

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

export const TableName = Symbol.for("Yatra/Table/Name");

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

export type RelationTableConstructor = new(
  args: any,
) => TableInstance<string, FieldsRecord>;

export type ExtractFields<T> = T extends TableType<any, infer F> ? F
  : never;

export type ExtractKeys<T> = keyof ExtractFields<T>;
export type ExtractTableName<T> = T extends TableType<infer N, any> ? N : never;

export class OneToOneRelation<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<S> = ExtractKeys<S>,
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public foreignKey: FK,
  ) {
    super(source, destination);
  }
}

export function oneToOne<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<S>,
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
) {
  return new OneToOneRelation(source, destination, foreignKey);
}

export class OneToManyRelation<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<D> = ExtractKeys<D>,
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public foreignKey: FK,
  ) {
    super(source, destination);
  }
}

export function oneToMany<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<D>,
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
) {
  return new OneToManyRelation(source, destination, foreignKey);
}

export class ManyToOneRelation<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<S> = ExtractKeys<S>,
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public foreignKey: FK,
  ) {
    super(source, destination);
  }
}

export function manyToOne<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<S>,
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
) {
  return new ManyToOneRelation(source, destination, foreignKey);
}

export class ManyToManyRelation<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  JT extends string = string,
  SK extends ExtractKeys<S> = ExtractKeys<S>,
  DK extends ExtractKeys<D> = ExtractKeys<D>,
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public joinTable: JT,
    public sourceKey: SK,
    public destinationKey: DK,
  ) {
    super(source, destination);
  }
}

export function manyToMany<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  JT extends string,
  SK extends ExtractKeys<S>,
  DK extends ExtractKeys<D>,
>(
  source: () => S,
  destination: () => D,
  joinTable: JT,
  sourceKey: SK,
  destinationKey: DK,
) {
  return new ManyToManyRelation(
    source,
    destination,
    joinTable,
    sourceKey,
    destinationKey,
  );
}
