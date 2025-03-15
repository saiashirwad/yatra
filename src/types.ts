import type { Column } from "./columns";

export type ManyToOneRelation<Ref, VirtualField, ForeignKey> = {
  kind: "many-to-one";
  ref: Ref;
  virtualField: VirtualField;
  foreignKey: ForeignKey;
};
export type OneToManyRelation<Ref> = { kind: "one-to-many"; ref: Ref };
export type OneToOneRelation<Ref, VirtualField, ForeignKey> = {
  kind: "one-to-one";
  ref: Ref;
  virtualField: VirtualField;
  foreignKey: ForeignKey;
};

export type RelationKind = "one-to-one" | "many-to-one" | "one-to-many";
export type Relation =
  | ManyToOneRelation<any, any, any>
  | OneToManyRelation<any>
  | OneToOneRelation<any, any, any>;

export type FieldsRecord = Record<string, Column<any, any>>;
export type RelationsRecord = Record<string, Relation>;
export type DefaultRelations = Record<string, never>;
export type TableConstructor<F> = new(...args: any[]) => { fields: F };
