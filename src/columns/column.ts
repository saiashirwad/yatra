import { Pipeable } from "effect";

export const Type = Symbol.for("Type");
export const DataType = Symbol.for("DataType");

export class Column<
  CT extends ColumnType,
  DT extends any,
> implements Pipeable.Pipeable {
  readonly [Type]: CT;
  declare readonly [DataType]: DT;

  constructor(type: CT) {
    this[Type] = type;
    this[DataType] = null as any;
  }

  pipe(...fns: Array<Function>) {
    return Pipeable.pipeArguments(
      this,
      arguments,
    );
  }
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

export type GetDataType<T> = T extends
  Column<any, infer DataType> ? DataType
  : never;
