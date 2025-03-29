import { Relation } from "./relation";
import type { ExtractKeys, TableLike } from "./utils";

/**
 * Specific relation type implementations
 */

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
