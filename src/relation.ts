import { type Pipeable, pipeArguments } from "./pipeable";

import type { ExtractKeys, TableLike } from "./utils";

const SourceTable = Symbol("SourceTable");
const DestinationTable = Symbol("DestinationTable");

/**
 * Base relation class that all specific relation types extend
 */
export class Relation<
  Source extends TableLike,
  Destination extends TableLike,
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

export class OneToOneRelation<
  S extends TableLike,
  D extends TableLike,
  FK extends string = string,
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
  S extends TableLike,
  D extends TableLike,
>(
  source: () => S,
  destination: () => D,
  foreignKey: string,
  referencedKey: ExtractKeys<D> = "id" as any,
) {
  return new OneToOneRelation(
    source,
    destination,
    foreignKey,
    referencedKey,
  );
}

export class OneToManyRelation<
  S extends TableLike,
  D extends TableLike,
  FK extends string = string,
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

export function oneToMany<
  S extends TableLike,
  D extends TableLike,
>(
  source: () => S,
  destination: () => D,
  foreignKey: string,
  referencedKey: ExtractKeys<D> = "id" as any,
) {
  return new OneToManyRelation(
    source,
    destination,
    foreignKey,
    referencedKey,
  );
}

export class ManyToOneRelation<
  S extends TableLike,
  D extends TableLike,
  FK extends string = string,
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
  S extends TableLike,
  D extends TableLike,
>(
  source: () => S,
  destination: () => D,
  foreignKey: string,
  referencedKey: ExtractKeys<D> = "id" as any,
) {
  return new ManyToOneRelation(
    source,
    destination,
    foreignKey,
    referencedKey,
  );
}

export class ManyToManyRelation<
  S extends TableLike,
  D extends TableLike,
  JT extends string = string,
  SK extends string = string,
  DK extends string = string,
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
  S extends TableLike,
  D extends TableLike,
>(
  source: () => S,
  destination: () => D,
  joinTable: string,
  sourceKey: string,
  destinationKey: string,
) {
  return new ManyToManyRelation(
    source,
    destination,
    joinTable,
    sourceKey,
    destinationKey,
  );
}
