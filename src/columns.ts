type Nullable = { readonly __nullable: true }
type Default<T> = { readonly default: T }
type MinLength<T extends number> = { readonly minLength: T }
type MaxLength<T extends number> = { readonly maxLength: T }
type Format<T extends string> = { readonly format: T }
type Enum<T extends unknown[]> = { readonly enum: T }
type Min<T extends number> = { readonly min: T }
type Max<T extends number> = { readonly max: T }
type Integer = { readonly integer: true }
type Unique = { readonly unique: true }
type PrimaryKey = { readonly primaryKey: true }
type References<T extends string> = { readonly references: { table: T; column: string } }
type AutoIncrement = { readonly autoIncrement: true }
type Generated<T extends string> = { readonly generated: { expression: T } }
type Comment<T extends string> = { readonly comment: T }
type Precision<T extends number> = { readonly precision: T }
type Scale<T extends number> = { readonly scale: T }
type Check<T extends string> = { readonly check: T }
type Index = { readonly index: true }
type SearchIndexed = { readonly searchIndexed: true }

export function extend<This, Brand>(
	instance: This,
	propertyName: string,
	propertyValue: unknown,
): This & Brand {
	const newInstance = Object.create(Object.getPrototypeOf(instance))

	Object.assign(newInstance, instance)
	;(newInstance as any)[propertyName] = propertyValue

	return newInstance as This & Brand
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
	| "enum"

export class Column<T extends ColumnType, DataType> {
	readonly type: T

	constructor(type: T) {
		this.type = type
	}

	nullable(): this & Nullable {
		return extend<this, Nullable>(this, "__nullable", true)
	}

	default<const V extends DataType>(value: V): this & Default<V> {
		return extend<this, Default<V>>(this, "default", value)
	}

	unique(): this & Unique {
		return extend<this, Unique>(this, "unique", true)
	}

	primaryKey(): this & PrimaryKey {
		return extend<this, PrimaryKey>(this, "primaryKey", true)
	}

	references<T extends string>(table: T, column: string): this & References<T> {
		return extend<this, References<T>>(this, "references", { table, column })
	}

	autoIncrement(): this & AutoIncrement {
		return extend<this, AutoIncrement>(this, "autoIncrement", true)
	}

	generated<T extends string>(expression: T): this & Generated<T> {
		return extend<this, Generated<T>>(this, "generated", { expression })
	}

	comment<T extends string>(text: T): this & Comment<T> {
		return extend<this, Comment<T>>(this, "comment", text)
	}

	check<T extends string>(expression: T): this & Check<T> {
		return extend<this, Check<T>>(this, "check", expression)
	}

	index(): this & Index {
		return extend<this, Index>(this, "index", true)
	}

	searchIndexed(): this & SearchIndexed {
		return extend<this, SearchIndexed>(this, "searchIndexed", true)
	}

	getConfig(): Record<string, unknown> {
		const config: Record<string, unknown> = { type: this.type }

		for (const key in this) {
			if (key !== "type" && !key.startsWith("_") && typeof (this as any)[key] !== "function") {
				config[key] = (this as any)[key]
			}
		}

		return config
	}
}

export type StringFormat = "uuid" | "json" | "email" | "url" | "cuid" | "ip" | "datetime"

export class StringColumn extends Column<"string", string> {
	constructor() {
		super("string")
	}

	minLength<T extends number>(length: T): this & MinLength<T> {
		return extend<this, MinLength<T>>(this, "minLength", length)
	}

	maxLength<T extends number>(length: T): this & MaxLength<T> {
		return extend<this, MaxLength<T>>(this, "maxLength", length)
	}

	format<T extends StringFormat>(formatType: T): this & Format<T> {
		return extend<this, Format<T>>(this, "format", formatType)
	}

	enum<T extends unknown[]>(values: T): this & Enum<T> {
		return extend<this, Enum<T>>(this, "enum", values)
	}
}

export class NumberColumn extends Column<"number", number> {
	constructor() {
		super("number")
	}

	min<T extends number>(value: T): this & Min<T> {
		return extend<this, Min<T>>(this, "min", value)
	}

	max<T extends number>(value: T): this & Max<T> {
		return extend<this, Max<T>>(this, "max", value)
	}

	integer(): this & Integer {
		return extend<this, Integer>(this, "integer", true)
	}

	precision<T extends number>(value: T): this & Precision<T> {
		return extend<this, Precision<T>>(this, "precision", value)
	}

	scale<T extends number>(value: T): this & Scale<T> {
		return extend<this, Scale<T>>(this, "scale", value)
	}
}

export class DecimalColumn extends Column<"decimal", string | number> {
	constructor() {
		super("decimal")
	}

	precision<T extends number>(value: T): this & Precision<T> {
		return extend<this, Precision<T>>(this, "precision", value)
	}

	scale<T extends number>(value: T): this & Scale<T> {
		return extend<this, Scale<T>>(this, "scale", value)
	}
}

export class BooleanColumn extends Column<"boolean", boolean> {
	constructor() {
		super("boolean")
	}
}

export class JsonColumn extends Column<"json", object | string> {
	constructor() {
		super("json")
	}
}

export class JsonbColumn extends Column<"jsonb", object | string> {
	constructor() {
		super("jsonb")
	}
}

export class UuidColumn extends Column<"uuid", string> {
	constructor() {
		super("uuid")
	}
}

export class TextColumn extends Column<"text", string> {
	constructor() {
		super("text")
	}
}

export class BigIntColumn extends Column<"bigint", bigint | number> {
	constructor() {
		super("bigint")
	}
}

export class TimestampColumn extends Column<"timestamp", Date | string | number> {
	constructor(private withTimezone: boolean = true) {
		super("timestamp")
	}

	getConfig(): Record<string, unknown> {
		const config = super.getConfig()
		config.withTimezone = this.withTimezone
		return config
	}

	withoutTimezone(): this {
		const clone = Object.create(Object.getPrototypeOf(this)) as this
		Object.assign(clone, this)
		clone.withTimezone = false
		return clone
	}
}

export class TimeColumn extends Column<"time", string | Date> {
	constructor(private withTz: boolean = false) {
		super("time")
	}

	getConfig(): Record<string, unknown> {
		const config = super.getConfig()
		config.withTimezone = this.withTimezone
		return config
	}

	withTimezone(): this {
		const clone = Object.create(Object.getPrototypeOf(this)) as this
		Object.assign(clone, this)
		clone.withTz = true
		return clone
	}
}

export class BinaryColumn extends Column<"binary", Uint8Array | Buffer | string> {
	constructor() {
		super("binary")
	}
}

export class ArrayColumn<ItemType extends Column<any, any>> extends Column<
	"array",
	Array<GetDataType<ItemType>>
> {
	private itemType: ItemType

	constructor(itemType: ItemType) {
		super("array")
		this.itemType = itemType
	}

	getConfig(): Record<string, unknown> {
		const config = super.getConfig()
		config.items = this.itemType.getConfig()
		return config
	}
}

export class EnumColumn<T extends string[]> extends Column<"enum", T[number]> {
	constructor(private values: T) {
		super("enum")
	}

	getConfig(): Record<string, unknown> {
		const config = super.getConfig()
		config.values = this.values
		return config
	}
}

export type DateDataType = Date | number

export class DateColumn extends Column<"date", DateDataType> {
	constructor() {
		super("date")
	}
}

export type LiteralFieldType = string | number | boolean

export class LiteralColumn<T extends LiteralFieldType> extends Column<"literal", T> {
	readonly literalValue: T

	constructor(value: T) {
		super("literal")
		this.literalValue = value
	}
}

export function string(): StringColumn {
	return new StringColumn()
}

export function number(): NumberColumn {
	return new NumberColumn()
}

export function date(): DateColumn {
	return new DateColumn()
}

export function literal<T extends LiteralFieldType>(value: T): LiteralColumn<T> {
	return new LiteralColumn(value)
}

export function boolean(): BooleanColumn {
	return new BooleanColumn()
}

export function json(): JsonColumn {
	return new JsonColumn()
}

export function jsonb(): JsonbColumn {
	return new JsonbColumn()
}

export function uuid(): UuidColumn {
	return new UuidColumn()
}

export function text(): TextColumn {
	return new TextColumn()
}

export function bigint(): BigIntColumn {
	return new BigIntColumn()
}

export function timestamp(withTimezone: boolean = true): TimestampColumn {
	return new TimestampColumn(withTimezone)
}

export function time(withTimezone: boolean = false): TimeColumn {
	return new TimeColumn(withTimezone)
}

export function binary(): BinaryColumn {
	return new BinaryColumn()
}

export function decimal(): DecimalColumn {
	return new DecimalColumn()
}

export function array<T extends Column<any, any>>(itemType: T): ArrayColumn<T> {
	return new ArrayColumn(itemType)
}

export function _enum<T extends string[]>(values: [...T]): EnumColumn<T> {
	return new EnumColumn(values)
}

export type IsPrimaryKey<T> = T extends PrimaryKey ? true : false
export type IsUnique<T> = T extends Unique ? true : false
export type GetReferences<T> = T extends References<infer Table>
	? { table: Table; column: string }
	: undefined
export type IsAutoIncrement<T> = T extends AutoIncrement ? true : false
export type GetGenerated<T> = T extends Generated<infer Expr> ? Expr : undefined
export type GetComment<T> = T extends Comment<infer Text> ? Text : undefined
export type GetPrecision<T> = T extends Precision<infer P> ? P : undefined
export type GetScale<T> = T extends Scale<infer S> ? S : undefined

export type GetColumnType<T> = T extends Column<infer Type, any> ? Type : never
export type GetDataType<T> = T extends Column<any, infer DataType> ? DataType : never
export type IsNullable<T> = T extends Nullable ? true : false
export type GetDefault<T> = T extends Default<infer V> ? V : undefined
export type GetMinLength<T> = T extends MinLength<infer V> ? V : undefined
export type GetMaxLength<T> = T extends MaxLength<infer V> ? V : undefined
