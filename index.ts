type Clean<T> = { [k in keyof T]: T[k] } & unknown;

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

function BaseColumn<const Type extends string, T = unknown>(
	type: Type,
): BaseColumn<T, Type, { type: Type }> {
	const options: BaseColumnOptions<T, Type> = { type };
	return {
		options,
		nullable() {
			return {
				...this,
				options: { ...options, __nullable: true },
			};
		},
		default<U extends T>(value: U) {
			return {
				...this,
				options: { ...options, __default: value },
			};
		},
	};
}

function string() {
	return { ...BaseColumn<"string", string>("string") };
}

function number() {
	return { ...BaseColumn<"number", number>("number") };
}

const nullableName = string().nullable();
console.log(nullableName);

const name = string().nullable().default("5");
console.log(name);
