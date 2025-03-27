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
  Column<any, any>
>;

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

    public oneToOne<D extends RelationTableConstructor>(
      destination: () => D,
      foreignKey: keyof this & string,
      referencedKey: ExtractKeys<D> = "id" as any,
    ) {
      return new OneToOneRelation(
        () => this.constructor as any,
        destination,
        foreignKey as any,
        referencedKey,
      );
    }

    public oneToMany<D extends RelationTableConstructor>(
      destination: () => D,
      foreignKey: keyof this & string,
      referencedKey: ExtractKeys<D> = "id" as any,
    ) {
      return new OneToManyRelation(
        () => this.constructor as any,
        destination,
        foreignKey as any,
        referencedKey as any,
      );
    }

    public manyToOne<D extends RelationTableConstructor>(
      destination: () => D,
      foreignKey: keyof this & string,
      referencedKey: ExtractKeys<D> = "id" as any,
    ) {
      return new ManyToOneRelation(
        () => this.constructor as any,
        destination,
        foreignKey as any,
        referencedKey,
      );
    }

    public manyToMany<D extends RelationTableConstructor>(
      destination: () => D,
      joinTable: string,
      sourceKey: keyof this & string,
      destinationKey: string,
    ) {
      return new ManyToManyRelation(
        () => this.constructor as any,
        destination,
        joinTable,
        sourceKey as any,
        destinationKey as any,
      );
    }
  }

  return TableClass as any as TableType<
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
> =
  & {
    [TableName]: TableName;
    [TableFields]: Fields;
    oneToOne<D extends RelationTableConstructor>(
      destination: () => D,
      foreignKey: keyof MakeTableObject<Fields> & string,
      referencedKey?: ExtractKeys<D>,
    ): OneToOneRelation<any, D, any, any>;
    oneToMany<D extends RelationTableConstructor>(
      destination: () => D,
      foreignKey: keyof MakeTableObject<Fields> & string,
      referencedKey?: ExtractKeys<D>,
    ): OneToManyRelation<any, D, any, any>;
    manyToOne<D extends RelationTableConstructor>(
      destination: () => D,
      foreignKey: keyof MakeTableObject<Fields> & string,
      referencedKey?: ExtractKeys<D>,
    ): ManyToOneRelation<any, D, any, any>;
    manyToMany<D extends RelationTableConstructor>(
      destination: () => D,
      joinTable: string,
      sourceKey: keyof MakeTableObject<Fields> & string,
      destinationKey: string,
    ): ManyToManyRelation<any, D, string, any, any>;
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

export class OneToOneRelation<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<S> = ExtractKeys<S>,
  RK extends ExtractKeys<D> = ExtractKeys<D>,
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public foreignKey: FK,
    public referencedKey: RK = "id" as any,
  ) {
    super(source, destination);
  }
}

export function oneToOne<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<S>,
  RK extends ExtractKeys<D> = ExtractKeys<D>,
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
  referencedKey: RK = "id" as any,
) {
  return new OneToOneRelation(source, destination, foreignKey, referencedKey);
}

export class OneToManyRelation<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<D> = ExtractKeys<D>,
  RK extends ExtractKeys<S> = ExtractKeys<S>,
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public foreignKey: FK,
    public referencedKey: RK = "id" as any,
  ) {
    super(source, destination);
  }
}

export function oneToMany<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<D>,
  RK extends ExtractKeys<S> = ExtractKeys<S>,
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
  referencedKey: RK = "id" as any,
) {
  return new OneToManyRelation(source, destination, foreignKey, referencedKey);
}

export class ManyToOneRelation<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<S> = ExtractKeys<S>,
  RK extends ExtractKeys<D> = ExtractKeys<D>,
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public foreignKey: FK,
    public referencedKey: RK = "id" as any,
  ) {
    super(source, destination);
  }
}

export function manyToOne<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
  FK extends ExtractKeys<S>,
  RK extends ExtractKeys<D> = ExtractKeys<D>,
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
  referencedKey: RK = "id" as any,
) {
  return new ManyToOneRelation(source, destination, foreignKey, referencedKey);
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
