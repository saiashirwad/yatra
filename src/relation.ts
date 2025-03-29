import { type Pipeable, pipeArguments } from "./pipeable";

import type { ExtractKeys, TableLike } from "./utils";

const SourceTable = Symbol("SourceTable");
const DestinationTable = Symbol("DestinationTable");

type RelationArgs = {
  Source: TableLike;
  Destination: TableLike;
};

export class Relation<
  const Args extends RelationArgs,
> implements Pipeable {
  public [SourceTable]: Args["Source"];
  public [DestinationTable]: Args["Destination"];

  constructor(
    source: () => Args["Source"],
    destination: () => Args["Destination"],
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
  const FK extends string = string,
  const RK extends ExtractKeys<D> = ExtractKeys<D>,
> extends Relation<{
  Source: S;
  Destination: D;
}> {
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
  const FK extends string = string,
  const RK extends ExtractKeys<D> = ExtractKeys<D> & string,
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
  referencedKey: RK = "id" as any,
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
  const FK extends string = string,
  const RK extends ExtractKeys<D> = ExtractKeys<D>,
> extends Relation<{
  Source: S;
  Destination: D;
}> {
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
  const FK extends string = string,
  const RK extends ExtractKeys<D> = ExtractKeys<D> & string,
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
  referencedKey: RK = "id" as any,
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
> extends Relation<{
  Source: S;
  Destination: D;
}> {
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
  const FK extends string = string,
  const RK extends ExtractKeys<D> = ExtractKeys<D> & string,
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
  referencedKey: RK = "id" as any,
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
  const JT extends string = string,
  const SK extends string = string,
  const DK extends string = string,
> extends Relation<{
  Source: S;
  Destination: D;
}> {
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
  const JT extends string = string,
  const SK extends string = string,
  const DK extends string = string,
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

export type TableRelations<
  T extends TableLike,
> =
  & {
    -readonly [
      key in keyof T["prototype"] as T["prototype"][key] extends Relation<any>
        ? key
        : never
    ]: T["prototype"][key];
  }
  & {};

export function getRelation<
  T extends TableLike,
  const Relations extends keyof {
    [k in keyof T["prototype"]]: T[k];
  },
>(c: T, name: Relations): T["prototype"][Relations] {
  return c.prototype[name];
}

export function getRelationNames<T extends TableLike>(
  table: T,
): TableRelations<T> {
  return Reflect.ownKeys(table.prototype).filter((key) => {
    return table.prototype[key] instanceof Relation;
  }) as any;
}
