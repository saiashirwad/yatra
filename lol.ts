type Fun = (...args: any) => any
type Arg<T extends Fun> = Parameters<T>[0]
type Ret<T extends Fun> = ReturnType<T>

function AddObject<
	T1 extends Object,
	T2 extends Object,
>(o1: T1, o2: T2): T1 & T2 {
	return Object.assign(o1, o2)
}

type _Implements_ = {
	__traits_marker__: undefined
}

interface TraitFactory<T extends Fun> {
	impl<Trait extends object>(
		this: TraitFactory<T>,
		trait: Trait,
	): TraitFactory<
		(arg: Arg<T>) => Ret<T> & _Implements_ & Trait
	>
	apply: T
}

function withTraits<T extends Fun>(
	apply: T,
): TraitFactory<T> {
	return {
		impl<Trait extends object>(trait: Trait) {
			return {
				impl: this.impl,
				apply: (arg) =>
					AddObject(this.apply(arg), trait),
			}
		},
		apply,
	}
}

interface Haha<Self> {
	add(this: Self, other: Self): Self
	sub(this: Self, other: Self): Self
	format(this: Self): string
}

interface Point {
	x: number
	y: number
}

let Point = withTraits<(p: Point) => Point>(
	(p) => p,
)
	.impl<Haha<Point>>({
		add(this, other) {
			return {
				x: this.x + other.x,
				y: this.y + other.y,
			}
		},
		sub(this, other) {
			return {
				x: this.x - other.x,
				y: this.y - other.y,
			}
		},
		format(this): string {
			return `(${this.x}, ${this.y})`
		},
	})
	.impl({
		valueOf(this: Point) {
			return this.x * this.y
		},
	}).apply

let p1 = Point({ x: 1, y: 2 })
let p2 = Point({ x: 3, y: 4 })

console.log(p1.format(), p2.valueOf())
