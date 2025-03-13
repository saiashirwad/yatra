type Class<O extends Record<string, unknown>> = {
	new (): InstanceType<new () => O>
}

type Constructor<Args = any, ReturnType = any> = new (
	...args: Args[]
) => ReturnType

function Dict<const O extends Record<string, unknown>>(
	obj: O,
) {
	return class {
		constructor() {
			Object.assign(this, obj)
		}
	} as Class<O>
}

function member<
	Co extends Constructor,
	Instance extends InstanceType<Co>,
	K extends keyof Instance,
>(c: Co, key: K): Instance[K] {
	return new c()[key]
}

type ValidKeys<D> = keyof {
	[K in keyof D as D[K] extends string ? K : never]: D[K]
}

function ref<
	Co extends Constructor,
	Instance extends InstanceType<Co>,
	K extends ValidKeys<Instance>,
>(c: () => Co, key: K) {
	return c
}

const asd = ref(() => Person, "name")

export class Person extends Dict({
	name: "hi",
	wrote: () => Book,
}) {}

const haha = member(Person, "name")

export class Book extends Dict({
	name: "what",
	otherBooks: () => new Array<Book>(),
	ownedBy: member(Person, "name"),
}) {}

export class Something extends Dict({
	name: "something",
	age: 2,
	owner: () => Person,
}) {}

const b = new Book()
console.log(b.name)

const ModelMap = {
	person: Person,
	book: Book,
	something: Something,
} as const

type ModelMap = typeof ModelMap

type ModelType = keyof ModelMap

type ModelDataType<T> = {
	[K in keyof T]: T[K] extends () => infer R
		? R extends new () => any
			? Partial<InstanceType<R>>
			: T[K]
		: T[K]
}

function model<T extends ModelType>(
	type: T,
	data?: Partial<InstanceType<ModelMap[T]>>,
): InstanceType<ModelMap[T]> {
	const instance = new ModelMap[type]() as InstanceType<
		ModelMap[T]
	>
	if (data) {
		Object.assign(instance, data)
	}
	return instance
}

function create<T extends ModelType>(
	type: T,
	data?: ModelDataType<InstanceType<ModelMap[T]>>,
): InstanceType<ModelMap[T]> {
	const instance = new ModelMap[type]() as InstanceType<
		ModelMap[T]
	>
	if (data) {
		const processedData = Object.entries(data).reduce(
			(acc, [key, value]) => {
				// @ts-ignore
				const propertyType = instance[key]
				if (
					typeof propertyType === "function" &&
					propertyType.prototype?.constructor
				) {
					// If it's a model reference, create an instance
					acc[key] = create(key as ModelType, value as any)
				} else {
					acc[key] = value
				}
				return acc
			},
			{} as any,
		)

		Object.assign(instance, processedData)
	}
	return instance
}

const what = create("something", {
	name: "something",
	age: 2,
	owner: {
		name: "hi",
	},
})

console.log(what.name)

function LazyDict<O extends Record<string, unknown>>(
	obj: O,
) {
	return class {
		constructor() {
			return new Proxy(this, {
				get(target, prop) {
					const value = obj[prop as string]
					if (typeof value === "function") {
						return value()
					}
					return value
				},
			})
		}
	} as unknown as Class<O>
}

export class LazyBook extends LazyDict({
	title: "whaaat",
	author: () => new Person(),
}) {}

const lb = new LazyBook()
console.log(lb.title)

type ValueType<T, K extends keyof T> = T[K] extends (
	...args: any
) => any
	? ReturnType<T[K]> extends Constructor
		? InstanceType<ReturnType<T[K]>>
		: ReturnType<T[K]>
	: T[K]

type ClassStructure<
	T extends Constructor,
	I = {
		-readonly [K in keyof InstanceType<T>]: ValueType<
			InstanceType<T>,
			K
		>
	},
> = I

type BookStructure = ClassStructure<typeof Book>
