import { type Pipeable, pipeArguments } from "../pipeable";

export const Type = Symbol.for("Yatra/Column/Type");
export const DataType = Symbol.for("Yatra/Column/DataType");

export class Column<CT extends ColumnType, DT extends any> implements Pipeable {
  readonly [Type]: CT;
  declare readonly [DataType]: DT;

  constructor(type: CT) {
    this[Type] = type;
    this[DataType] = null as any;
  }

  pipe(..._: Array<Function>) {
    return pipeArguments(this, arguments);
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

export type GetDataType<T> = T extends Column<any, infer DataType> ? DataType : never;
