import type { Column, DataType } from "./column";
import { extend } from "./utils";

export type ColumnPropertyName = string | symbol;

export const ColumnName = Symbol.for("Yatra/ColumnName");
export type ColumnName<T extends string> = { readonly [ColumnName]: T };
export const columnName =
  <Col extends Column<any, any>, const ColName extends string>(name: ColName) =>
  (c: Col) => extend<Col, ColumnName<ColName>>(c, ColumnName, name);

export const Nullable = Symbol.for("Yatra/Nullable");
export type Nullable = { readonly [Nullable]: true };
export type IsNullable<T> = T extends Nullable ? true : false;
export const nullable = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, Nullable>(c, Nullable, true);

export const Unique = Symbol.for("Yatra/Unique");
export type Unique = { readonly [Unique]: true };
export type IsUnique<T> = T extends Unique ? true : false;
export const unique = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, Unique>(c, Unique, true);

export const PrimaryKey = Symbol.for("Yatra/PrimaryKey");
export type PrimaryKey = { readonly [PrimaryKey]: true };
export type IsPrimaryKey<T> = T extends PrimaryKey ? true : false;
export const primaryKey = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, PrimaryKey>(c, PrimaryKey, true);

export const Default = Symbol.for("Yatra/Default");
export type Default<T> = { readonly [Default]: T };
export type GetDefault<T> = T extends Default<infer V> ? V : undefined;
export const defaultValue =
  <Col extends Column<any, any>, const V extends Col[typeof DataType]>(
    value: V,
  ) =>
  (c: Col) => extend<Col, Default<V>>(c, Default, value);

export const MinLength = Symbol.for("Yatra/MinLength");
export type MinLength<T extends number> = { readonly [MinLength]: T };
export type GetMinLength<T> = T extends MinLength<infer V> ? V : undefined;
export const minLength =
  <Col extends Column<"string" | "text", any>, const T extends number>(
    value: T,
  ) =>
  (c: Col) => extend<Col, MinLength<T>>(c, MinLength, value);

export const MaxLength = Symbol.for("Yatra/MaxLength");
export type MaxLength<T extends number> = { readonly [MaxLength]: T };
export type GetMaxLength<T> = T extends MaxLength<infer V> ? V : undefined;
export const maxLength =
  <Col extends Column<"string" | "text", any>, const T extends number>(
    value: T,
  ) =>
  (c: Col) => extend<Col, MaxLength<T>>(c, MaxLength, value);

export const Format = Symbol.for("Yatra/Format");
export type Format<T extends string> = { readonly [Format]: T };
export const format =
  <Col extends Column<any, any>, const Fmt extends string>(fmt: Fmt) =>
  (c: Col) => extend<Col, Format<Fmt>>(c, Format, fmt);

export const Enum = Symbol.for("Yatra/Enum");
export type Enum<T extends unknown[]> = { readonly [Enum]: T };

export const Min = Symbol.for("Yatra/Min");
export type Min<T extends number> = { readonly [Min]: T };
export const min =
  <Col extends Column<"number", any>, const M extends number>(minValue: M) =>
  (c: Col) => extend<Col, Min<M>>(c, Min, minValue);

export const Max = Symbol.for("Yatra/Max");
export type Max<T extends number> = { readonly [Max]: T };
export const max =
  <Col extends Column<"number", any>, const M extends number>(maxValue: M) =>
  (c: Col) => extend<Col, Max<M>>(c, Max, maxValue);

export const Integer = Symbol.for("Yatra/Integer");
export type Integer = { readonly [Integer]: true };
export const integer = <Col extends Column<"number", any>>(c: Col) =>
  extend<Col, Integer>(c, Integer, true);

export const References = Symbol.for("Yatra/References");
export type References<T extends string> = {
  readonly [References]: { table: T; column: string };
};
export type GetReferences<T> = T extends References<infer Table>
  ? { table: Table; column: string }
  : undefined;
export const references =
  <Col extends Column<any, any>, const T extends string>(
    table: T,
    column: string,
  ) =>
  (c: Col) => extend<Col, References<T>>(c, References, { table, column });

export const AutoIncrement = Symbol.for("Yatra/AutoIncrement");
export type AutoIncrement = { readonly [AutoIncrement]: true };
export type IsAutoIncrement<T> = T extends AutoIncrement ? true : false;
export const autoIncrement = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, AutoIncrement>(c, AutoIncrement, true);

export const Generated = Symbol.for("Yatra/Generated");
export type Generated<T extends string> = {
  readonly [Generated]: { expression: T };
};
export type GetGenerated<T> = T extends Generated<infer Expr> ? Expr
  : undefined;
export const generated =
  <Col extends Column<any, any>, const T extends string>(expression: T) =>
  (c: Col) => extend<Col, Generated<T>>(c, Generated, { expression });

export const Comment = Symbol.for("Yatra/Comment");
export type Comment<T extends string> = { readonly [Comment]: T };
export type GetComment<T> = T extends Comment<infer Text> ? Text : undefined;
export const comment =
  <Col extends Column<any, any>, const T extends string>(text: T) => (c: Col) =>
    extend<Col, Comment<T>>(c, Comment, text);

export const Precision = Symbol.for("Yatra/Precision");
export type Precision<T extends number> = { readonly [Precision]: T };
export type GetPrecision<T> = T extends Precision<infer P> ? P : undefined;
export const precision =
  <Col extends Column<"number" | "decimal", any>, const T extends number>(
    value: T,
  ) =>
  (c: Col) => extend<Col, Precision<T>>(c, Precision, value);

export const Scale = Symbol.for("Yatra/Scale");
export type Scale<T extends number> = { readonly [Scale]: T };
export type GetScale<T> = T extends Scale<infer S> ? S : undefined;
export const scale =
  <Col extends Column<"number" | "decimal", any>, const T extends number>(
    value: T,
  ) =>
  (c: Col) => extend<Col, Scale<T>>(c, Scale, value);

export const Check = Symbol.for("Yatra/Check");
export type Check<T extends string> = { readonly [Check]: T };
export const check =
  <Col extends Column<any, any>, const T extends string>(expression: T) =>
  (c: Col) => extend<Col, Check<T>>(c, Check, expression);

export const Index = Symbol.for("Yatra/Index");
export type Index = { readonly [Index]: true };
export const index = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, Index>(c, Index, true);

export const SearchIndexed = Symbol.for("Yatra/SearchIndexed");
export type SearchIndexed = { readonly [SearchIndexed]: true };
export const searchIndexed = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, SearchIndexed>(c, SearchIndexed, true);

export const LiteralValue = Symbol.for("Yatra/LiteralValue");
export const ItemType = Symbol.for("Yatra/ItemType");
export const EnumValues = Symbol.for("Yatra/EnumValues");
