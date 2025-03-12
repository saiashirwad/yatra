type Clean<T> = { [k in keyof T]: T[k] } & unknown
type Trim<T> = {
	[k in keyof T as T[k] extends undefined ? never : k]: T[k]
}

function updateOptions<
	T extends {
		options: Record<string, unknown>
	},
	KV extends { [k: string]: unknown },
>(r: T, kv: KV): Clean<T & { options: KV }> {
	return {
		...r,
		options: { ...r.options, ...kv },
	}
}

type BaseColumnOptions<Type extends string, T> = {
	type: Type
	__nullable?: boolean
	__default?: T
}

interface Column<
	Type extends string,
	T,
	options extends BaseColumnOptions<Type, T> = {
		type: Type
	},
> {
	options: BaseColumnOptions<Type, T>
	nullable: () => Column<Type, T, Clean<options & { __nullable: true }>>
	default: <V extends T>(
		value: V,
	) => Column<Type, T, Clean<options & { __default: V }>>
}

function Column<
	const Type extends string,
	T = unknown,
	options extends BaseColumnOptions<Type, T> = {
		type: Type
	},
>(type: Type, defaultOptions?: options): Column<Type, T, options> {
	const options = {
		type,
		...(defaultOptions ?? {}),
	}
	return {
		options,
		nullable() {
			return updateOptions(this, {
				__nullable: true,
			})
		},
		default<U extends T>(value: U) {
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
	options extends StringColumnOptions = {
		type: "string"
	},
> = Column<"string", string, options> & {
	minLength: <T extends number>(
		length: T,
	) => StringColumn<Clean<options & { __minLength: T }>>
	maxLength: <T extends number>(
		length: T,
	) => StringColumn<Clean<options & { __maxLength: T }>>
	format: <T extends StringFormat>(
		format: T,
	) => StringColumn<Clean<options & { __format: T }>>
	enum: <T extends unknown[]>(
		values: T,
	) => StringColumn<Clean<options & { __enum: T }>>
}

function string(): StringColumn {
	return {
		...Column<"string", string>("string"),
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

type LiteralType = string | number | boolean

type LiteralColumn<T extends LiteralType> = Column<"literal", T>

function literal<const T extends LiteralType>(value: T): LiteralColumn<T> {
	const base = Column<`literal`, T, { type: "literal"; __literalValue: T }>(
		"literal",
		{
			type: "literal",
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
	options extends NumberColumnOptions = {
		type: "number"
	},
> = Column<"number", number, options> & {
	min: <V extends number>(
		value: V,
	) => NumberColumn<Clean<options & { __min: V }>>
	max: <V extends number>(
		value: V,
	) => NumberColumn<Clean<options & { __max: V }>>
	integer: () => NumberColumn<Clean<options & { __integer: true }>>
}

function number(): NumberColumn {
	const base = Column<"number", number>("number")

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

const uuidField = string().format("uuid").nullable().default("something")
console.log(uuidField.options)

const something = literal("hi")
console.log(something.options.type)

const username = string().minLength(3).maxLength(20)
console.log(username.options)

const age = number().min(0).max(120).integer()
console.log(age.options)

const price = number().max(2).min(-2)
console.log(price.options)

const enumTest = string().enum(["admin", "user", "guest"])
console.log(enumTest.options)
