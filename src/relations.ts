import { type Pipeable, pipeArguments } from "./pipeable";
import type { TableType } from "./types";
import type { FieldsRecord, TableInstance } from "./types";

export const SourceTable = Symbol.for("Yatra/Relation/SourceTable");
export const DestinationTable = Symbol.for("Yatra/Relation/DestinationTable");
export const TableFields = Symbol.for("Yatra/Table/Fields");

type RelationTableConstructor = new(
  args: any,
) => TableInstance<string, FieldsRecord>;

export type ExtractFields<T> = T extends TableType<any, infer F> ? F
  : never;

export type ExtractKeys<T> = keyof ExtractFields<T>;
export type ExtractTableName<T> = T extends TableType<infer N, any> ? N : never;

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

  pipe(..._: Array<Function>) {
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
