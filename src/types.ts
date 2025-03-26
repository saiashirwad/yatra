import type { Column } from "./columns/column";

export type ManyToManyRelation<
  Ref,
  VirtualField,
  ForeignKey,
> = {
  kind: "many-to-many";
  ref: Ref;
  virtualField: VirtualField;
  foreignKey: ForeignKey;
};

export type ManyToOneRelation<
  Ref,
  VirtualField,
  ForeignKey,
> = {
  kind: "many-to-one";
  ref: Ref;
  virtualField: VirtualField;
  foreignKey: ForeignKey;
};

export type OneToManyRelation<Ref> = {
  kind: "one-to-many";
  ref: Ref;
};

export type OneToOneRelation<
  Ref,
  VirtualField,
  ForeignKey,
> = {
  kind: "one-to-one";
  ref: Ref;
  virtualField: VirtualField;
  foreignKey: ForeignKey;
};

export type RelationKind =
  | "one-to-one"
  | "many-to-one"
  | "one-to-many";

export type Relation =
  | ManyToOneRelation<any, any, any>
  | OneToManyRelation<any>
  | OneToOneRelation<any, any, any>
  | ManyToManyRelation<any, any, any>;

export type FieldsRecord = Record<
  string,
  Column<any, any>
>;

export type RelationsRecord = Record<
  string,
  Relation
>;

export type DefaultRelations = Record<
  string,
  Relation
>;

export type TableConstructor<F> = new(
  ...args: any[]
) => { fields: F };

export type TableCallback<
  Fields extends FieldsRecord,
  Relations extends RelationsRecord,
> = (
  fields: Fields,
) => { relations: Relations };
