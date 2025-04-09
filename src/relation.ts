import { type Pipeable, pipeArguments } from "./pipeable"
import type {
  Clean,
  QualifiedFieldName,
  Tableish
} from "./utils"

export namespace Relations {
  export type OneToOne<
    Source extends Tableish,
    Destination extends Tableish,
    FK = QualifiedFieldName<Source>,
    RK = QualifiedFieldName<Destination>
  > = Clean<{
    readonly type: "one-to-one"
    source: Source
    destination: Destination
    foreignKey: FK
    referencedKey: RK
  }>
}
export const Relations = {
  oneToOne: <
    Source extends Tableish,
    Destination extends Tableish,
    FK = QualifiedFieldName<Source>,
    RK = QualifiedFieldName<Destination>
  >(
    source: () => Source,
    destination: () => Destination,
    foreignKey: FK,
    referencedKey: RK
  ): Relations.OneToOne<Source, Destination, FK, RK> => ({
    type: "one-to-one",
    source: source(),
    destination: destination(),
    foreignKey,
    referencedKey
  })
}

export class Relation<
  Source extends Tableish,
  Destination extends Tableish
> implements Pipeable
{
  public sourceTable: Source
  public destinationTable: Destination

  constructor(
    source: () => Source,
    destination: () => Destination
  ) {
    this.sourceTable = source()
    this.destinationTable = destination()
  }

  pipe(...fns: Array<Function>) {
    return pipeArguments(this, arguments)
  }
}

export class OneToOneRelation<
  S extends Tableish,
  D extends Tableish,
  const FK = QualifiedFieldName<S>,
  const RK = QualifiedFieldName<D>
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public foreignKey: FK,
    public referencedKey: RK = "id" as any
  ) {
    super(source, destination)
  }
}

export function oneToOne<
  S extends Tableish,
  D extends Tableish,
  const FK extends QualifiedFieldName<S>,
  const RK extends QualifiedFieldName<D>
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
  referencedKey: RK
) {
  return new OneToOneRelation(
    source,
    destination,
    foreignKey,
    referencedKey
  )
}

export class OneToManyRelation<
  S extends Tableish,
  D extends Tableish,
  const FK extends QualifiedFieldName<S>,
  const RK extends QualifiedFieldName<D>
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public foreignKey: FK,
    public referencedKey: RK = "id" as any
  ) {
    super(source, destination)
  }
}

export function oneToMany<
  S extends Tableish,
  D extends Tableish,
  const FK extends QualifiedFieldName<S>,
  const RK extends QualifiedFieldName<D>
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
  referencedKey: RK = "id" as any
) {
  return new OneToManyRelation(
    source,
    destination,
    foreignKey,
    referencedKey
  )
}

export class ManyToOneRelation<
  S extends Tableish,
  D extends Tableish,
  const FK extends QualifiedFieldName<S>,
  const RK extends QualifiedFieldName<D>
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public foreignKey: FK,
    public referencedKey: RK = "id" as any
  ) {
    super(source, destination)
  }
}

export function manyToOne<
  S extends Tableish,
  D extends Tableish,
  const FK extends QualifiedFieldName<S>,
  const RK extends QualifiedFieldName<D>
>(
  source: () => S,
  destination: () => D,
  foreignKey: FK,
  referencedKey: RK = "id" as any
) {
  return new ManyToOneRelation(
    source,
    destination,
    foreignKey,
    referencedKey
  )
}

export class ManyToManyRelation<
  S extends Tableish,
  D extends Tableish,
  const JT extends string,
  const SK extends QualifiedFieldName<S>,
  const DK extends QualifiedFieldName<D>
> extends Relation<S, D> {
  constructor(
    source: () => S,
    destination: () => D,
    public joinTable: JT,
    public sourceKey: SK,
    public destinationKey: DK
  ) {
    super(source, destination)
  }
}

export function manyToMany<
  S extends Tableish,
  D extends Tableish,
  const JT extends string,
  const SK extends QualifiedFieldName<S>,
  const DK extends QualifiedFieldName<D>
>(
  source: () => S,
  destination: () => D,
  joinTable: JT,
  sourceKey: SK,
  destinationKey: DK
) {
  return new ManyToManyRelation(
    source,
    destination,
    joinTable,
    sourceKey,
    destinationKey
  )
}

export type TableRelations<T extends Tableish> = {
  -readonly [key in keyof T["prototype"] as T["prototype"][key] extends (
    Relation<any, any>
  ) ?
    key
  : never]: Clean<T["prototype"][key]>
} & {}

export function getRelation<
  T extends Tableish,
  const Relations extends keyof {
    [k in keyof T["prototype"]]: T[k]
  }
>(c: T, name: Relations): T["prototype"][Relations] {
  return c.prototype[name]
}

export function getRelationNames<T extends Tableish>(
  table: T
): TableRelations<T> {
  return Reflect.ownKeys(table.prototype).filter(key => {
    return table.prototype[key] instanceof Relation
  }) as any
}

// type RelationType =
//   | "one-to-one"
//   | "one-to-many"
//   | "many-to-one"
//   | "many-to-many";
//
// type Reln<
//   Type extends RelationType,
//   Source extends Tableish,
//   Destination extends Tableish,
//   FK extends QualifiedFieldName<Source>,
//   DK extends QualifiedFieldName<Destination>,
//   JoinTable extends string | undefined,
// > =
//   & ({ source: () => Source; destination: () => Destination; fk: FK; rk: DK })
//   & ({
//     type: "one-to-one" | "one-to-many" | "many-to-one";
//   } | {
//     type: "many-to-many";
//     joinTable: Type extends "many-to-many" ? JoinTable : never;
//   });
//
// export class Relation2<
//   Type extends RelationType,
//   Source extends Tableish,
//   Destination extends Tableish,
//   FK extends QualifiedFieldName<Source>,
//   RK extends QualifiedFieldName<Destination>,
//   JoinTable extends string | undefined,
// > {
//   constructor(
//     public args: Reln<Type, Source, Destination, FK, RK, JoinTable>,
//   ) {}
// }
//
// export function relation<
//   Type extends RelationType,
//   Source extends Tableish,
//   Destination extends Tableish,
//   FK extends QualifiedFieldName<Source>,
//   RK extends QualifiedFieldName<Destination>,
//   JoinTable extends string | undefined,
// >(
//   type: Type,
//   source: () => Source,
//   destination: () => Destination,
//   args: Omit<
//     Reln<Type, Source, Destination, FK, RK, JoinTable>,
//     "type" | "source" | "destination"
//   >,
// ) {
//   return new Relation2({ type, source, destination, ...args } as any);
// }
