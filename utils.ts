export type Class<O extends Record<string, unknown>> = {
	new (): InstanceType<new () => O>
}

export type Clean<T> = { [K in keyof T]: T[K] } & unknown
