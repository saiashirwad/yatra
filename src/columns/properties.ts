import type { Column, DataType } from "./column";
import { extend } from "./utils";

export type ColumnPropertyName = string | symbol;

export const ColumnName = Symbol.for(
  "ColumnName",
);
export const Nullable = Symbol.for("Nullable");
export const Unique = Symbol.for("Unique");
export const PrimaryKey = Symbol.for(
  "PrimaryKey",
);
export const Default = Symbol.for("Default");
export const MinLength = Symbol.for("MinLength");
export const MaxLength = Symbol.for("MaxLength");
export const Format = Symbol.for("Format");
export const Enum = Symbol.for("Enum");
export const Min = Symbol.for("Min");
export const Max = Symbol.for("Max");
export const Integer = Symbol.for("Integer");
export const References = Symbol.for(
  "References",
);
export const AutoIncrement = Symbol.for(
  "AutoIncrement",
);
export const Generated = Symbol.for("Generated");
export const Comment = Symbol.for("Comment");
export const Precision = Symbol.for("Precision");
export const Scale = Symbol.for("Scale");
export const Check = Symbol.for("Check");
export const Index = Symbol.for("Index");
export const SearchIndexed = Symbol.for(
  "SearchIndexed",
);

export const LiteralValue = Symbol.for(
  "LiteralValue",
);

export const ItemType = Symbol.for("ItemType");

export const EnumValues = Symbol.for(
  "EnumValues",
);

export type ColumnName<T extends string> = {
  readonly [ColumnName]: T;
};
export type Nullable = {
  readonly [Nullable]: true;
};
export type Default<T> = {
  readonly [Default]: T;
};
export type MinLength<T extends number> = {
  readonly [MinLength]: T;
};
export type MaxLength<T extends number> = {
  readonly [MaxLength]: T;
};
export type Format<T extends string> = {
  readonly [Format]: T;
};
export type Enum<T extends unknown[]> = {
  readonly [Enum]: T;
};
export type Min<T extends number> = {
  readonly [Min]: T;
};
export type Max<T extends number> = {
  readonly [Max]: T;
};
export type Integer = {
  readonly [Integer]: true;
};
export type Unique = { readonly [Unique]: true };
export type PrimaryKey = {
  readonly [PrimaryKey]: true;
};
export type References<T extends string> = {
  readonly [References]: {
    table: T;
    column: string;
  };
};
export type AutoIncrement = {
  readonly [AutoIncrement]: true;
};
export type Generated<T extends string> = {
  readonly [Generated]: { expression: T };
};
export type Comment<T extends string> = {
  readonly [Comment]: T;
};
export type Precision<T extends number> = {
  readonly [Precision]: T;
};
export type Scale<T extends number> = {
  readonly [Scale]: T;
};
export type Check<T extends string> = {
  readonly [Check]: T;
};
export type Index = { readonly [Index]: true };
export type SearchIndexed = {
  readonly [SearchIndexed]: true;
};

export type IsPrimaryKey<T> = T extends PrimaryKey
  ? true
  : false;

export type IsUnique<T> = T extends Unique ? true
  : false;

export type GetReferences<T> = T extends
  References<infer Table>
  ? { table: Table; column: string }
  : undefined;

export type IsAutoIncrement<T> = T extends
  AutoIncrement ? true
  : false;

export type GetGenerated<T> = T extends
  Generated<infer Expr> ? Expr
  : undefined;

export type GetComment<T> = T extends
  Comment<infer Text> ? Text
  : undefined;

export type GetPrecision<T> = T extends
  Precision<infer P> ? P
  : undefined;

export type GetScale<T> = T extends Scale<infer S>
  ? S
  : undefined;

export type IsNullable<T> = T extends Nullable
  ? true
  : false;
export type GetDefault<T> = T extends
  Default<infer V> ? V
  : undefined;
export type GetMinLength<T> = T extends
  MinLength<infer V> ? V
  : undefined;
export type GetMaxLength<T> = T extends
  MaxLength<infer V> ? V
  : undefined;

export const nullable = <
  Col extends Column<any, any>,
>(c: Col) =>
  extend<Col, Nullable>(c, Nullable, true);

export const unique = <
  Col extends Column<any, any>,
>(c: Col) => extend<Col, Unique>(c, Unique, true);

export const primaryKey = <
  Col extends Column<any, any>,
>(c: Col) =>
  extend<Col, PrimaryKey>(c, PrimaryKey, true);

export const defaultValue = <
  Col extends Column<any, any>,
  const V extends Col[typeof DataType],
>(value: V) =>
(c: Col) =>
  extend<Col, Default<V>>(c, Default, value);

export const columnName = <
  Col extends Column<any, any>,
  const ColName extends string,
>(name: ColName) =>
(c: Col) =>
  extend<Col, ColumnName<ColName>>(
    c,
    ColumnName,
    name,
  );

export const format = <
  Col extends Column<any, any>,
  const Fmt extends string,
>(fmt: Fmt) =>
(c: Col) =>
  extend<Col, Format<Fmt>>(c, Format, fmt);

export const min = <
  Col extends Column<"number", any>,
  const M extends number,
>(minValue: M) =>
(c: Col) => extend<Col, Min<M>>(c, Min, minValue);

export const max = <
  Col extends Column<"number", any>,
  const M extends number,
>(maxValue: M) =>
(c: Col) => extend<Col, Max<M>>(c, Max, maxValue);

export const integer = <
  Col extends Column<"number", any>,
>(c: Col) =>
  extend<Col, Integer>(c, Integer, true);

export const references = <
  Col extends Column<any, any>,
  const T extends string,
>(table: T, column: string) =>
(c: Col) =>
  extend<Col, References<T>>(c, References, {
    table,
    column,
  });

export const autoIncrement = <
  Col extends Column<any, any>,
>(c: Col) =>
  extend<Col, AutoIncrement>(
    c,
    AutoIncrement,
    true,
  );

export const generated = <
  Col extends Column<any, any>,
  const T extends string,
>(expression: T) =>
(c: Col) =>
  extend<Col, Generated<T>>(c, Generated, {
    expression,
  });

export const comment = <
  Col extends Column<any, any>,
  const T extends string,
>(text: T) =>
(c: Col) =>
  extend<Col, Comment<T>>(c, Comment, text);

export const precision = <
  Col extends Column<"number" | "decimal", any>,
  const T extends number,
>(value: T) =>
(c: Col) =>
  extend<Col, Precision<T>>(c, Precision, value);

export const scale = <
  Col extends Column<"number" | "decimal", any>,
  const T extends number,
>(value: T) =>
(c: Col) =>
  extend<Col, Scale<T>>(c, Scale, value);

export const check = <
  Col extends Column<any, any>,
  const T extends string,
>(expression: T) =>
(c: Col) =>
  extend<Col, Check<T>>(c, Check, expression);

export const index = <
  Col extends Column<any, any>,
>(c: Col) => extend<Col, Index>(c, Index, true);

export const searchIndexed = <
  Col extends Column<any, any>,
>(c: Col) =>
  extend<Col, SearchIndexed>(
    c,
    SearchIndexed,
    true,
  );

export const maxLength = <
  Col extends Column<"string" | "text", any>,
  const T extends number,
>(value: T) =>
(c: Col) =>
  extend<Col, MaxLength<T>>(c, MaxLength, value);

export const minLength = <
  Col extends Column<"string" | "text", any>,
  const T extends number,
>(value: T) =>
(c: Col) =>
  extend<Col, MinLength<T>>(c, MinLength, value);
