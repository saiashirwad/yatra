import type { HKT } from "./hkt"

type Clean<T> = { [K in keyof T]: T[K] } & unknown

export interface Identity extends HKT.Kind {
	f<T>(x: HKT.Cast<this[HKT._], T>): typeof x
}

type Duplicate_<x> = x extends
	| string
	| number
	| boolean
	? `${x}${x}`
	: never

export interface Duplicate extends HKT.Kind {
	f<T>(
		x: HKT.Cast<this[HKT._], T>,
	): Duplicate_<typeof x>
}

type result = HKT.Pipe<
	[Duplicate, Duplicate],
	"hi"
>

type result2 = HKT.Apply<Identity, { what: "up" }>
