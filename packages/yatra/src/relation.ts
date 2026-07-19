import { type Pipeable, pipeArguments } from "./pipeable.ts"
import type {
  QualifiedFieldName,
  Tableish
} from "./utils.ts"
export type RelationType =
  | "one-to-one"
  | "one-to-many"
  | "many-to-one"
  | "many-to-many"
export class Relation<
  Source extends Tableish,
  Destination extends Tableish
> implements Pipeable {
  declare readonly type: RelationType
  public sourceTable: Source
  public destinationTable: Destination
  constructor(
    source: () => Source,
    destination: () => Destination
  ) {
    this.sourceTable = source()
    this.destinationTable = destination()
  }
  pipe(..._: Array<Function>) {
    return pipeArguments(this, arguments)
  }
}
export class OneToOneRelation<
  S extends Tableish,
  D extends Tableish,
  const FK = QualifiedFieldName<S>,
  const RK = QualifiedFieldName<D>
> extends Relation<S, D> {
  readonly type = "one-to-one" as const
  readonly foreignKey: FK
  readonly referencedKey: RK
  constructor(
    source: () => S,
    destination: () => D,
    foreignKey: FK,
    referencedKey: RK = "id" as RK
  ) {
    super(source, destination)
    this.foreignKey = foreignKey
    this.referencedKey = referencedKey
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
  const FK = QualifiedFieldName<S>,
  const RK = QualifiedFieldName<D>
> extends Relation<S, D> {
  readonly type = "one-to-many" as const
  readonly foreignKey: FK
  readonly referencedKey: RK
  constructor(
    source: () => S,
    destination: () => D,
    foreignKey: FK,
    referencedKey: RK = "id" as RK
  ) {
    super(source, destination)
    this.foreignKey = foreignKey
    this.referencedKey = referencedKey
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
  referencedKey: RK = "id" as RK
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
  const FK = QualifiedFieldName<S>,
  const RK = QualifiedFieldName<D>
> extends Relation<S, D> {
  readonly type = "many-to-one" as const
  readonly foreignKey: FK
  readonly referencedKey: RK
  constructor(
    source: () => S,
    destination: () => D,
    foreignKey: FK,
    referencedKey: RK = "id" as RK
  ) {
    super(source, destination)
    this.foreignKey = foreignKey
    this.referencedKey = referencedKey
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
  referencedKey: RK = "id" as RK
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
  const JT extends string = string,
  const SK = QualifiedFieldName<S>,
  const DK = QualifiedFieldName<D>
> extends Relation<S, D> {
  readonly type = "many-to-many" as const
  readonly joinTable: JT
  readonly sourceKey: SK
  readonly destinationKey: DK
  constructor(
    source: () => S,
    destination: () => D,
    joinTable: JT,
    sourceKey: SK,
    destinationKey: DK
  ) {
    super(source, destination)
    this.joinTable = joinTable
    this.sourceKey = sourceKey
    this.destinationKey = destinationKey
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
  -readonly [key in keyof T["prototype"] as T["prototype"][key] extends Relation<
    any,
    any
  >
    ? key
    : never]: T["prototype"][key]
} & {}
