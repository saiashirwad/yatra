function Class<const Name extends string>(name: Name) {
	return class {
		public name: Name
		constructor() {
			this.name = name
		}
	}
}

class Haha extends Class("Hi") {
	getName() {
		return this.name
	}
}
const haha = new Haha()
const lol = haha.getName()

console.log(haha)
