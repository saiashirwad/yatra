export type Clean<T> = { [k in keyof T]: T[k] } & unknown

export type Class<O extends Record<string, unknown>> = {
	new (): InstanceType<new () => O>
}

export type Constructor<Args = any, ReturnType = any> = new (
	...args: Args[]
) => ReturnType

export function member<
	Co extends Constructor,
	Instance extends InstanceType<Co>,
	K extends keyof Instance,
>(c: Co, key: K): Instance[K] {
	return new c()[key]
}
