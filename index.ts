type Clean<T> = { [k in keyof T]: T[k] } & unknown;

function updateOptions<
	T extends { options: Record<string, unknown> },
	KV extends { [k: string]: unknown },
>(r: T, kv: KV): Clean<T & { options: KV }> {
	return { ...r, options: { ...r.options, ...kv } };
}

type BaseColumnOptions<T, Type extends string> = {
	type: Type;
	__nullable?: boolean;
	__default?: T;
};

type BaseColumn<
	T,
	Type extends string,
	options extends BaseColumnOptions<T, Type> = { type: Type },
> = {
	options: BaseColumnOptions<T, Type>;
	nullable: () => BaseColumn<T, Type, Clean<options & { __nullable: true }>>;
	default: (value: T) => BaseColumn<T, Type, Clean<options & { __default: T }>>;
};

type StringColumnOptions = BaseColumnOptions<string, "string"> & {
	__minLength?: number;
	__maxLength?: number;
	__format?: "email" | "url" | "uuid" | "date";
	__enum?: string[];
};

type StringColumn<options extends StringColumnOptions = { type: "string" }> =
	BaseColumn<string, "string", options> & {
		minLength: (
			length: number,
		) => StringColumn<Clean<options & { __minLength: number }>>;
		maxLength: (
			length: number,
		) => StringColumn<Clean<options & { __maxLength: number }>>;
		format: (
			format: "email" | "url" | "uuid" | "date",
		) => StringColumn<
			Clean<options & { __format: "email" | "url" | "uuid" | "date" }>
		>;
		enum: (
			values: string[],
		) => StringColumn<Clean<options & { __enum: string[] }>>;
	};

type NumberColumnOptions = BaseColumnOptions<number, "number"> & {
	__min?: number;
	__max?: number;
	__integer?: boolean;
	__positive?: boolean;
	__negative?: boolean;
};

type NumberColumn<options extends NumberColumnOptions = { type: "number" }> =
	BaseColumn<number, "number", options> & {
		min: (value: number) => NumberColumn<Clean<options & { __min: number }>>;
		max: (value: number) => NumberColumn<Clean<options & { __max: number }>>;
		integer: () => NumberColumn<Clean<options & { __integer: true }>>;
		positive: () => NumberColumn<Clean<options & { __positive: true }>>;
		negative: () => NumberColumn<Clean<options & { __negative: true }>>;
	};

function BaseColumn<const Type extends string, T = unknown>(
	type: Type,
): BaseColumn<T, Type, { type: Type }> {
	const options: BaseColumnOptions<T, Type> = { type };
	return {
		options,
		nullable() {
			return updateOptions(this, { __nullable: true });
		},
		default<U extends T>(value: U) {
			return updateOptions(this, { __default: value });
		},
	};
}

function string() {
	const base = BaseColumn<"string", string>("string");

	return {
		...base,
		minLength(value: number) {
			return updateOptions(this, { __minLength: value });
		},
		maxLength(value: number) {
			return updateOptions(this, { __maxLength: value });
		},
		format(format: "email" | "url" | "uuid" | "date") {
			return updateOptions(this, { __format: format });
		},
		enum(values: string[]) {
			return updateOptions(this, { __enum: values });
		},
	};
}

type LiteralType = string | number | boolean;

function literal<const T extends LiteralType>(value: T) {
	const base = BaseColumn<`${T}`, T>(`${value}`);

	return base;
}

function number() {
	const base = BaseColumn<"number", number>("number");

	return {
		...base,
		min(value: number) {
			return updateOptions(this, { __min: value });
		},
		max(value: number) {
			return updateOptions(this, { __max: value });
		},
		integer() {
			return updateOptions(this, { __integer: true });
		},
		positive() {
			return updateOptions(this, { __positive: true, __negative: false });
		},
		negative() {
			return updateOptions(this, { __positive: false, __negative: true });
		},
	};
}

const emailField = string().format("email").nullable().default("");
console.log(emailField.options);

const something = literal("hi");
console.log(something.options.type);

const username = string().minLength(3).maxLength(20);
console.log(username.options);

const age = number().min(0).max(120).integer();
console.log(age.options);

const price = number().positive().min(0.01);
console.log(price.options);

const enumTest = string().enum(["admin", "user", "guest"]).options;
console.log(enumTest);
