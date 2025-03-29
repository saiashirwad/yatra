import {
  ManyToManyRelation,
  ManyToOneRelation,
  OneToManyRelation,
  OneToOneRelation,
} from "./relation-types";
import type { ExtractKeys, RelationTableConstructor } from "./table-types";

/**
 * Global relation functions for defining table relationships
 */

export function oneToOne<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
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

export function oneToMany<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
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

export function manyToOne<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
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

export function manyToMany<
  S extends RelationTableConstructor,
  D extends RelationTableConstructor,
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
