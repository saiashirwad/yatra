import { Column, DataType } from "./column"
import { EnumValues } from "./properties"

class StringColumn extends Column<"string", string> {
  constructor() {
    super("string")
  }
}

class NumberColumn extends Column<"number", number> {
  constructor() {
    super("number")
  }
}

class BooleanColumn extends Column<"boolean", boolean> {
  constructor() {
    super("boolean")
  }
}

class DateColumn extends Column<"date", Date | number> {
  constructor() {
    super("date")
  }
}

class JsonColumn extends Column<"json", object | string> {
  constructor() {
    super("json")
  }
}

class JsonbColumn extends Column<"jsonb", object | string> {
  constructor() {
    super("jsonb")
  }
}

export class UuidColumn extends Column<"uuid", string> {
  constructor() {
    super("uuid")
  }
}

class TextColumn extends Column<"text", string> {
  constructor() {
    super("text")
  }
}

class BigIntColumn extends Column<
  "bigint",
  bigint | number
> {
  constructor() {
    super("bigint")
  }
}

class TimestampColumn extends Column<
  "timestamp",
  Date | string | number
> {
  private withTz: boolean

  constructor(withTimezone: boolean = true) {
    super("timestamp")
    this.withTz = withTimezone
  }

  withoutTimezone(): TimestampColumn {
    return new TimestampColumn(false)
  }

  get withTimezone(): boolean {
    return this.withTz
  }
}

class TimeColumn extends Column<"time", string | Date> {
  private withTz: boolean

  constructor(withTimezone: boolean = false) {
    super("time")
    this.withTz = withTimezone
  }

  withTimezone(): TimeColumn {
    return new TimeColumn(true)
  }
}

class BinaryColumn extends Column<
  "binary",
  Uint8Array | Buffer | string
> {
  constructor() {
    super("binary")
  }
}

class DecimalColumn extends Column<
  "decimal",
  string | number
> {
  constructor() {
    super("decimal")
  }
}

const LiteralValue = Symbol.for("Yatra/LiteralValue")
class LiteralColumn<
  T extends string | number | boolean
> extends Column<"literal", T> {
  readonly [LiteralValue]: T

  constructor(value: T) {
    super("literal")
    this[LiteralValue] = value
  }
}

const ArrayItemType = Symbol.for("Yatra/ItemType")
class ArrayColumn<
  ItemType extends Column<any, any>
> extends Column<
  "array",
  Array<ItemType[typeof DataType]>
> {
  readonly [ArrayItemType]: ItemType

  constructor(itemType: ItemType) {
    super("array")
    this[ArrayItemType] = itemType
  }
}

class EnumColumn<T extends string[]> extends Column<
  "enum",
  T[number]
> {
  readonly [EnumValues]: T

  constructor(values: T) {
    super("enum")
    this[EnumValues] = values
  }
}

// export function string(): StringColumn {
//   return new StringColumn();
// }

export const string = new StringColumn()
export const number = new NumberColumn()
export const boolean = new BooleanColumn()
export const date = new DateColumn()
export const json = new JsonColumn()
export const jsonb = new JsonbColumn()
export const uuid = new UuidColumn()
export const text = new TextColumn()
export const bigint = new BigIntColumn()
export const timestamp = new TimestampColumn()
export const time = new TimeColumn()
export const binary = new BinaryColumn()
export const decimal = new DecimalColumn()

export function literal<
  T extends string | number | boolean
>(value: T): LiteralColumn<T> {
  return new LiteralColumn<T>(value)
}

export function array<T extends Column<any, any>>(
  itemType: T
): ArrayColumn<T> {
  return new ArrayColumn<T>(itemType)
}

export function enum_<T extends string[]>(
  values: T
): EnumColumn<T> {
  return new EnumColumn<T>(values)
}
