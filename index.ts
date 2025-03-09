type Clean<T> = { [k in keyof T]: T[k] } & unknown;

type BaseColumnOptions<T> = {
	type: string;
	__nullable?: boolean;
	__default?: T;
};

type BaseColumn<T, options extends BaseColumnOptions<T>> = {
	options: BaseColumnOptions<T>;
	nullable: () => BaseColumn<T, Clean<options & { __nullable: true }>>;
	default: (value: T) => BaseColumn<T, Clean<options & { __default: T }>>;
};

function BaseColumn<const type extends string, T = unknown>(
	type: type,
): BaseColumn<T, { type: type }> {
	const options: BaseColumnOptions<T> = { type };
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

function StringColumn() {
	return { ...BaseColumn<"string", string>("string") };
}

function NumberColumn() {
	return { ...BaseColumn<"number", number>("number") };
}

const nullableName = StringColumn().nullable();
console.log(nullableName);

const name = StringColumn().nullable().default("5");
console.log(name);
