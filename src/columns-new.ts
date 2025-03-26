import { Pipeable } from "effect";
import { dual, pipe } from "effect/Function";
import type { Null } from "effect/Schema";

const Type = Symbol.for("Type");
const DataType = Symbol.for("DataType");

const ColumnName = Symbol.for("ColumnName");

type ColumnName<T extends string> = { readonly [ColumnName]: T };

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

type Nullable = {
  readonly [Nullable]: true;
};
type Default<T> = {
  readonly [Default]: T;
};
type MinLength<T extends number> = {
  readonly [MinLength]: T;
};
type MaxLength<T extends number> = {
  readonly [MaxLength]: T;
};
type Format<T extends string> = {
  readonly [Format]: T;
};
type Enum<T extends unknown[]> = {
  readonly [Enum]: T;
};
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
type AutoIncrement = {
  readonly [AutoIncrement]: true;
};
type Generated<T extends string> = {
  readonly [Generated]: { expression: T };
};
type Comment<T extends string> = {
  readonly [Comment]: T;
};
type Precision<T extends number> = {
  readonly [Precision]: T;
};
type Scale<T extends number> = {
  readonly [Scale]: T;
};
type Check<T extends string> = {
  readonly [Check]: T;
};
type Index = { readonly [Index]: true };
type SearchIndexed = {
  readonly [SearchIndexed]: true;
};

export function extend<This, Brand>(
  instance: This,
  propertyName: string | symbol,
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

interface BaseColumn<CT extends ColumnType, DT extends any>
  extends Pipeable.Pipeable
{
  [Type]: CT;
  [DataType]: DT;
}

function makeColumn<CT extends ColumnType, DT extends any>(
  type: CT,
): BaseColumn<CT, DT> {
  return {
    [DataType]: null as any,
    [Type]: type,
    pipe() {
      return Pipeable.pipeArguments(this, arguments);
    },
  };
}

interface StringColumn<ColumnName extends string = "">
  extends BaseColumn<"string", string>
{
}

function string<ColumnName extends string>(): StringColumn<ColumnName> {
  return makeColumn("string");
}

function makeProperty<const Property>(
  propertyName: string | symbol,
  propertyValue: unknown,
) {
  return <Col extends BaseColumn<any, any>>(c: Col) =>
    extend<Col, Property>(c, propertyName, propertyValue);
}

const nullable = makeProperty<Nullable>(Nullable, true);
const unique = makeProperty<Unique>(Unique, true);

function defaultValue<
  Col extends BaseColumn<any, any>,
  const V extends Col[typeof DataType],
>(
  value: V,
) {
  return (c: Col) => {
    return extend<Col, Default<V>>(c, Default, value);
  };
}

const lol = string().pipe(nullable);
const lol2 = pipe(string(), defaultValue("asdf"), nullable);

const something = pipe(string(), nullable, unique);

console.log(lol, lol2, something);
