class A {
	constructor(public b?: B) {}
}

class B {
	constructor(public as: Array<A>) {}
}

const a = new A(new B([]))

console.log(a)
