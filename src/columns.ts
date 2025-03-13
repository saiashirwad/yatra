export type Clean<T> = { [k in keyof T]: T[k] } & unknown

export type Constructor<Args = any, ReturnType = any> = new (...args: Args[]) => ReturnType

// Options for a generic column
export interface BaseColumnOptions<FieldType extends string, DataType> {
	name: FieldType
	__nullable?: boolean
	__default?: DataType
}

/****************************************************
 * 2) Abstract Column Class
 ****************************************************/

export abstract class Column<
	FieldType extends string,
	DataType,
	Options extends BaseColumnOptions<FieldType, DataType>,
> {
	constructor(public readonly options: Options) {}

	// For immutability: produce a fresh instance with updated options
	protected cloneWith(update: Partial<Options>): this {
		const merged = {
			...this.options,
			...update,
		}
		// Creates a new instance using this class's constructor
		return new (this.constructor as { new (opts: Options): this })(merged as Options)
	}

	// Make column nullable
	nullable(): this {
		return this.cloneWith({ __nullable: true } as Partial<Options>)
	}

	// Set a default value
	default(value: DataType): this {
		return this.cloneWith({ __default: value } as Partial<Options>)
	}
}

/****************************************************
 * 3) Specific Column Subclasses
 ****************************************************/

/*
  A) StringColumn
*/
type StringFormat = "uuid" | "json"
export interface StringColumnOptions extends BaseColumnOptions<"string", string> {
	__minLength?: number
	__maxLength?: number
	__format?: StringFormat
	__enum?: unknown[]
}

export class StringColumn<Options extends StringColumnOptions = { name: "string" }> extends Column<
	"string",
	string,
	Options
> {
	constructor(opts?: Partial<Options>) {
		super({
			name: "string",
			...((opts as object) || {}),
		} as Options)
	}

	minLength(value: number): this {
		return this.cloneWith({ __minLength: value } as Partial<Options>)
	}

	maxLength(value: number): this {
		return this.cloneWith({ __maxLength: value } as Partial<Options>)
	}

	format(fmt: StringFormat): this {
		return this.cloneWith({ __format: fmt } as Partial<Options>)
	}

	enum(values: unknown[]): this {
		return this.cloneWith({ __enum: values } as Partial<Options>)
	}
}

/*
  B) NumberColumn
*/
export interface NumberColumnOptions extends BaseColumnOptions<"number", number> {
	__min?: number
	__max?: number
	__integer?: boolean
}

export class NumberColumn<Options extends NumberColumnOptions = { name: "number" }> extends Column<
	"number",
	number,
	Options
> {
	constructor(opts?: Partial<Options>) {
		super({
			name: "number",
			...((opts as object) || {}),
		} as Options)
	}

	min(value: number): this {
		return this.cloneWith({ __min: value } as Partial<Options>)
	}

	max(value: number): this {
		return this.cloneWith({ __max: value } as Partial<Options>)
	}

	integer(): this {
		return this.cloneWith({ __integer: true } as Partial<Options>)
	}
}

/*
  C) DateColumn
*/
export type DateDataType = Date | number

export interface DateColumnOptions extends BaseColumnOptions<"date", DateDataType> {}

export class DateColumn<Options extends DateColumnOptions = { name: "date" }> extends Column<
	"date",
	DateDataType,
	Options
> {
	constructor(opts?: Partial<Options>) {
		super({
			name: "date",
			...((opts as object) || {}),
		} as Options)
	}
}

/*
  D) LiteralColumn
     (For an exact literal value: e.g. literal(true), literal("foo"), etc.)
*/
export type LiteralFieldType = string | number | boolean
interface LiteralColumnOptions<DataType extends LiteralFieldType>
	extends BaseColumnOptions<"literal", DataType> {
	__literalValue?: DataType
}

export class LiteralColumn<
	DataType extends LiteralFieldType,
	Options extends LiteralColumnOptions<DataType> = {
		name: "literal"
		__literalValue: DataType
	},
> extends Column<"literal", DataType, Options> {
	constructor(value: DataType) {
		super({
			name: "literal",
			__literalValue: value,
		} as Options)
	}
}

/****************************************************
 * 4) Convenience Constructors
 ****************************************************/

export function stringColumn() {
	return new StringColumn()
}

export function numberColumn() {
	return new NumberColumn()
}

export function dateColumn() {
	return new DateColumn()
}

export function literalColumn<const V extends LiteralFieldType>(value: V) {
	return new LiteralColumn<V>(value)
}
