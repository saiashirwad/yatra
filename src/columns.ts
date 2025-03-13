import type { Clean } from "./utils"

function updateOptions<
	T extends { options: Record<string, unknown> },
	KV extends { [k: string]: unknown },
>(r: T, kv: KV): Clean<T & { options: KV }> {
	return {
		...r,
		options: { ...r.options, ...kv },
	}
}

export type BaseColumnOptions<FieldType extends string, DataType> = {
	name: FieldType
	__nullable?: boolean
	__default?: DataType
}

export interface BaseColumn<
	FieldType extends string,
	DataType,
	options extends BaseColumnOptions<FieldType, DataType> = {
		name: FieldType
	},
> {
	options: BaseColumnOptions<FieldType, DataType>
	nullable: () => BaseColumn<FieldType, DataType, Clean<options & { __nullable: true }>>
	default: <V extends DataType>(
		value: V,
	) => BaseColumn<FieldType, DataType, Clean<options & { __default: V }>>
}

export function BaseColumn<
	const FieldType extends string,
	DataType = unknown,
	Options extends BaseColumnOptions<FieldType, DataType> = {
		name: FieldType
	},
>(name: FieldType, defaultOptions?: Options): BaseColumn<FieldType, DataType, Options> {
	const options = {
		name,
		...(defaultOptions ?? {}),
	}
	return {
		options,
		nullable() {
			return updateOptions(this, {
				__nullable: true,
			})
		},
		default<U extends DataType>(value: U) {
			return updateOptions(this, {
				__default: value,
			})
		},
	}
}

type StringFormat = "uuid" | "json"

type StringColumnOptions = BaseColumnOptions<"string", string> & {
	__minLength?: number
	__maxLength?: number
	__format?: StringFormat
	__enum?: unknown[]
}

type StringColumn<
	Options extends StringColumnOptions = {
		name: "string"
	},
> = BaseColumn<"string", string, Options> & {
	minLength: <T extends number>(length: T) => StringColumn<Clean<Options & { __minLength: T }>>
	maxLength: <T extends number>(length: T) => StringColumn<Clean<Options & { __maxLength: T }>>
	format: <T extends StringFormat>(format: T) => StringColumn<Clean<Options & { __format: T }>>
	enum: <T extends unknown[]>(values: T) => StringColumn<Clean<Options & { __enum: T }>>
}

export function string(): StringColumn {
	return {
		...BaseColumn<"string", string>("string"),
		minLength(value) {
			return updateOptions(this, {
				__minLength: value,
			})
		},
		maxLength(value) {
			return updateOptions(this, {
				__maxLength: value,
			})
		},
		format(format) {
			return updateOptions(this, {
				__format: format,
			})
		},
		enum(values) {
			return updateOptions(this, {
				__enum: values,
			})
		},
	}
}

type LiteralFieldType = string | number | boolean

type LiteralColumn<DataType extends LiteralFieldType> = BaseColumn<"literal", DataType>

export function literal<const DataType extends LiteralFieldType>(
	value: DataType,
): LiteralColumn<DataType> {
	const base = BaseColumn<`literal`, DataType, { name: "literal"; __literalValue: DataType }>(
		"literal",
		{
			name: "literal",
			__literalValue: value,
		},
	)
	return {
		...base,
		options: {
			...base.options,
		},
	}
}

type NumberColumnOptions = BaseColumnOptions<"number", number> & {
	__min?: number
	__max?: number
	__integer?: boolean
}

type NumberColumn<
	Options extends NumberColumnOptions = {
		name: "number"
	},
> = BaseColumn<"number", number, Options> & {
	min: <V extends number>(value: V) => NumberColumn<Clean<Options & { __min: V }>>
	max: <V extends number>(value: V) => NumberColumn<Clean<Options & { __max: V }>>
	integer: () => NumberColumn<Clean<Options & { __integer: true }>>
}

export function number(): NumberColumn {
	const base = BaseColumn<"number", number>("number")

	return {
		...base,
		min(value) {
			return updateOptions(this, {
				__min: value,
			})
		},
		max(value) {
			return updateOptions(this, {
				__max: value,
			})
		},
		integer() {
			return updateOptions(this, {
				__integer: true,
			})
		},
	}
}

type DateDataType = Date | number
type DateColumnOptions = BaseColumnOptions<"date", DateDataType> & {}

type DateColumn<
	Options extends DateColumnOptions = {
		name: "date"
	},
> = BaseColumn<"date", DateDataType, Options> & {}

export function date(): DateColumn {
	const base = BaseColumn<"date", DateDataType>("date")

	return {
		...base,
	}
}
