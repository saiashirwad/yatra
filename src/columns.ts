type Nullable = { readonly __nullable: true }
type Default<T> = { readonly default: T }
type MinLength<T extends number> = { readonly minLength: T }
type MaxLength<T extends number> = { readonly maxLength: T }
type Format<T extends string> = { readonly format: T }
type Enum<T extends unknown[]> = { readonly enum: T }
type Min<T extends number> = { readonly min: T }
type Max<T extends number> = { readonly max: T }
type Integer = { readonly integer: true }

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

export type ColumnType = "string" | "number" | "date" | "literal"

export class Column<T extends ColumnType, DataType> {
	readonly type: T

	constructor(type: T) {
		this.type = type
	}

	nullable(): this & Nullable {
		return extend<this, Nullable>(this, "__nullable", true)
	}

	default<V extends DataType>(value: V): this & Default<V> {
		return extend<this, Default<V>>(this, "default", value)
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

export type StringFormat = "uuid" | "json"

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

export type GetColumnType<T> = T extends Column<infer Type, any> ? Type : never
export type GetDataType<T> = T extends Column<any, infer DataType> ? DataType : never
export type IsNullable<T> = T extends Nullable ? true : false
export type GetDefault<T> = T extends Default<infer V> ? V : undefined
export type GetMinLength<T> = T extends MinLength<infer V> ? V : undefined
export type GetMaxLength<T> = T extends MaxLength<infer V> ? V : undefined
