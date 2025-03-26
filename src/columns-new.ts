import { Pipeable } from "effect";
import { pipe } from "effect/Function";

type PropertyName = string | symbol;

const Type = Symbol.for("Type");
const DataType = Symbol.for("DataType");

const ColumnName = Symbol.for("ColumnName");
const Nullable = Symbol.for("Nullable");
const Unique = Symbol.for("Unique");
const PrimaryKey = Symbol.for("PrimaryKey");
const Default = Symbol.for("Default");
const MinLength = Symbol.for("MinLength");
const MaxLength = Symbol.for("MaxLength");
const Format = Symbol.for("Format");
const Enum = Symbol.for("Enum");
const Min = Symbol.for("Min");
const Max = Symbol.for("Max");
const Integer = Symbol.for("Integer");
const References = Symbol.for("References");
const AutoIncrement = Symbol.for("AutoIncrement");
const Generated = Symbol.for("Generated");
const Comment = Symbol.for("Comment");
const Precision = Symbol.for("Precision");
const Scale = Symbol.for("Scale");
const Check = Symbol.for("Check");
const Index = Symbol.for("Index");
const SearchIndexed = Symbol.for("SearchIndexed");

type ColumnName<T extends string> = { readonly [ColumnName]: T };
type Nullable = { readonly [Nullable]: true };
type Default<T> = { readonly [Default]: T };
type MinLength<T extends number> = { readonly [MinLength]: T };
type MaxLength<T extends number> = { readonly [MaxLength]: T };
type Format<T extends string> = { readonly [Format]: T };
type Enum<T extends unknown[]> = { readonly [Enum]: T };
type Min<T extends number> = { readonly [Min]: T };
type Max<T extends number> = { readonly [Max]: T };
type Integer = { readonly [Integer]: true };
type Unique = { readonly [Unique]: true };
type PrimaryKey = { readonly [PrimaryKey]: true };
type References<T extends string> = {
  readonly [References]: {
    table: T;
    column: string;
  };
};
type AutoIncrement = { readonly [AutoIncrement]: true };
type Generated<T extends string> = {
  readonly [Generated]: { expression: T };
};
type Comment<T extends string> = { readonly [Comment]: T };
type Precision<T extends number> = { readonly [Precision]: T };
type Scale<T extends number> = { readonly [Scale]: T };
type Check<T extends string> = { readonly [Check]: T };
type Index = { readonly [Index]: true };
type SearchIndexed = { readonly [SearchIndexed]: true };

export function extend<This, Brand>(
  instance: This,
  propertyName: PropertyName,
  propertyValue: unknown,
): This & Brand {
  const newInstance = Object.create(
    Object.getPrototypeOf(instance),
  );

  Object.assign(newInstance, instance);
  (newInstance as any)[propertyName] = propertyValue;

  return newInstance as This & Brand;
}

export type ColumnType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "literal"
  | "json"
  | "jsonb"
  | "uuid"
  | "array"
  | "binary"
  | "text"
  | "bigint"
  | "timestamp"
  | "time"
  | "inet"
  | "cidr"
  | "macaddr"
  | "decimal"
  | "enum";

// interface Column<CT extends ColumnType, DT extends any>
//   extends Pipeable.Pipeable
// {
//   [Type]: CT;
//   [DataType]: DT;
// }

// function Column<CT extends ColumnType, DT extends any>(
//   type: CT,
// ): Column<CT, DT> {
//   return {
//     [DataType]: null as any,
//     [Type]: type,
//     pipe() {
//       return Pipeable.pipeArguments(this, arguments);
//     },
//   };
// }

class Column<CT extends ColumnType, DT extends any>
  implements Pipeable.Pipeable
{
  readonly [Type]: CT;
  declare readonly [DataType]: DT;

  constructor(type: CT) {
    this[Type] = type;
    this[DataType] = null as any;
  }

  pipe(...fns: Array<Function>) {
    return Pipeable.pipeArguments(this, arguments);
  }
}

interface StringColumn extends Column<"string", string> {}
interface NumberColumn extends Column<"number", number> {}
interface BooleanColumn extends Column<"boolean", boolean> {}
interface DateColumn extends Column<"date", Date | number> {}
interface JsonColumn extends Column<"json", object | string> {}
interface JsonbColumn extends Column<"jsonb", object | string> {}
interface UuidColumn extends Column<"uuid", string> {}
interface TextColumn extends Column<"text", string> {}
interface BigIntColumn extends Column<"bigint", bigint | number> {}
interface TimestampColumn extends Column<"timestamp", Date | string | number> {}
interface TimeColumn extends Column<"time", string | Date> {}
interface BinaryColumn extends Column<"binary", Uint8Array | Buffer | string> {}
interface DecimalColumn extends Column<"decimal", string | number> {}

const LiteralValue = Symbol.for("LiteralValue");
interface LiteralColumn<T extends string | number | boolean>
  extends Column<"literal", T>
{
  readonly [LiteralValue]: T;
}

const ItemType = Symbol.for("ItemType");
interface ArrayColumn<ItemType extends Column<any, any>>
  extends Column<"array", Array<ItemType[typeof DataType]>>
{
  readonly [ItemType]: ItemType;
}

const EnumValues = Symbol.for("EnumValues");
interface EnumColumn<T extends string[]> extends Column<"enum", T[number]> {
  readonly [EnumValues]: T;
}

export const minLength = <
  Col extends Column<"string", any>,
  const MinL extends number,
>(length: MinL) =>
(c: Col) => extend<Col, MinLength<MinL>>(c, MinLength, length);

export const maxLength = <
  Col extends Column<"string", any>,
  const MaxL extends number,
>(length: MaxL) =>
(c: Col) => extend<Col, MaxLength<MaxL>>(c, MaxLength, length);

class StringColumn extends Column<"string", string> {
  constructor() {
    super("string");
  }

  minLength<T extends number>(
    length: T,
  ): this & MinLength<T> {
    return pipe(this, minLength(length));
  }

  maxLength<T extends number>(
    length: T,
  ): this & MaxLength<T> {
    return pipe(this, maxLength(length));
  }
}

export function string(): StringColumn {
  return new StringColumn();
}

export function number(): NumberColumn {
  return new Column("number");
}

export function boolean(): BooleanColumn {
  return new Column("boolean");
}

export function date(): DateColumn {
  return new Column("date");
}

export function json(): JsonColumn {
  return new Column("json");
}

export function jsonb(): JsonbColumn {
  return new Column("jsonb");
}

export function uuid(): UuidColumn {
  return new Column("uuid");
}

export function text(): TextColumn {
  return new Column("text");
}

export function bigint(): BigIntColumn {
  return new Column("bigint");
}

export function timestamp(withTimezone: boolean = true): TimestampColumn {
  const col = new Column<"timestamp", Date | string | number>("timestamp");
  return extend(col, "withTimezone", withTimezone);
}

export function time(withTimezone: boolean = false): TimeColumn {
  const col = new Column<"time", string | Date>("time");
  return extend(col, "withTimezone", withTimezone);
}

export function binary(): BinaryColumn {
  return new Column("binary");
}

export function decimal(): DecimalColumn {
  return new Column("decimal");
}

export function literal<T extends string | number | boolean>(
  value: T,
): LiteralColumn<T> {
  const col = new Column<"literal", T>("literal");
  return extend(col, LiteralValue, value) as any;
}

export function array<T extends Column<any, any>>(
  itemType: T,
): ArrayColumn<T> {
  const col = new Column<"array", Array<T[typeof DataType]>>("array");
  return extend(col, ItemType, itemType) as any;
}

export function enum_<T extends string[]>(values: T): EnumColumn<T> {
  const col = new Column<"enum", T[number]>("enum");
  return extend(col, EnumValues, values) as any;
}

// Column modifiers
export const nullable = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, Nullable>(c, Nullable, true);

export const unique = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, Unique>(c, Unique, true);

export const primaryKey = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, PrimaryKey>(c, PrimaryKey, true);

export const defaultValue = <
  Col extends Column<any, any>,
  const V extends Col[typeof DataType],
>(value: V) =>
(c: Col) => extend<Col, Default<V>>(c, Default, value);

export const columnName = <
  Col extends Column<any, any>,
  const ColName extends string,
>(name: ColName) =>
(c: Col) => extend<Col, ColumnName<ColName>>(c, ColumnName, name);

export const format = <
  Col extends Column<any, any>,
  const Fmt extends string,
>(fmt: Fmt) =>
(c: Col) => extend<Col, Format<Fmt>>(c, Format, fmt);

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

export const integer = <Col extends Column<"number", any>>(c: Col) =>
  extend<Col, Integer>(c, Integer, true);

export const references = <
  Col extends Column<any, any>,
  const T extends string,
>(table: T, column: string) =>
(c: Col) => extend<Col, References<T>>(c, References, { table, column });

export const autoIncrement = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, AutoIncrement>(c, AutoIncrement, true);

export const generated = <
  Col extends Column<any, any>,
  const T extends string,
>(expression: T) =>
(c: Col) => extend<Col, Generated<T>>(c, Generated, { expression });

export const comment = <
  Col extends Column<any, any>,
  const T extends string,
>(text: T) =>
(c: Col) => extend<Col, Comment<T>>(c, Comment, text);

export const precision = <
  Col extends Column<"number" | "decimal", any>,
  const T extends number,
>(value: T) =>
(c: Col) => extend<Col, Precision<T>>(c, Precision, value);

export const scale = <
  Col extends Column<"number" | "decimal", any>,
  const T extends number,
>(value: T) =>
(c: Col) => extend<Col, Scale<T>>(c, Scale, value);

export const check = <
  Col extends Column<any, any>,
  const T extends string,
>(expression: T) =>
(c: Col) => extend<Col, Check<T>>(c, Check, expression);

export const index = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, Index>(c, Index, true);

export const searchIndexed = <Col extends Column<any, any>>(c: Col) =>
  extend<Col, SearchIndexed>(c, SearchIndexed, true);

export type IsPrimaryKey<T> = T extends PrimaryKey ? true
  : false;

export type IsUnique<T> = T extends Unique ? true : false;

export type GetReferences<T> = T extends References<infer Table>
  ? { table: Table; column: string }
  : undefined;

export type IsAutoIncrement<T> = T extends AutoIncrement ? true
  : false;

export type GetGenerated<T> = T extends Generated<infer Expr> ? Expr
  : undefined;

export type GetComment<T> = T extends Comment<infer Text> ? Text
  : undefined;

export type GetPrecision<T> = T extends Precision<infer P> ? P
  : undefined;

export type GetScale<T> = T extends Scale<infer S> ? S
  : undefined;

export type IsNullable<T> = T extends Nullable ? true
  : false;
export type GetDefault<T> = T extends Default<infer V> ? V
  : undefined;
export type GetMinLength<T> = T extends MinLength<infer V> ? V
  : undefined;
export type GetMaxLength<T> = T extends MaxLength<infer V> ? V
  : undefined;

export type GetDataType<T> = T extends Column<any, infer DataType> ? DataType
  : never;

export type GetColumnType<T> = T extends StringColumn ? string
  : T extends NumberColumn ? number
  : T extends BooleanColumn ? boolean
  : T extends DateColumn ? Date
  : T extends LiteralColumn<infer V> ? V
  : T extends JsonColumn | JsonbColumn ? object | string
  : T extends UuidColumn ? string
  : T extends ArrayColumn<infer ItemType> ? Array<GetDataType<ItemType>>
  : T extends TextColumn ? string
  : T extends BigIntColumn ? bigint | number
  : T extends TimestampColumn ? Date | string | number
  : T extends TimeColumn ? string | Date
  : T extends BinaryColumn ? Uint8Array | Buffer | string
  : T extends DecimalColumn ? string | number
  : T extends EnumColumn<infer Values> ? Values[number]
  : never;

const userNameColumn = pipe(
  string(),
  columnName("user_name"),
  minLength(3),
  maxLength(50),
  unique,
  nullable,
);

const idColumn = pipe(
  number(),
  columnName("id"),
  primaryKey,
  autoIncrement,
);
