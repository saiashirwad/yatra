function Class<const Name extends string>(name: Name) {
  return class {
    public name: Name;
    constructor() {
      this.name = name;
    }
  };
}

function Dict<const Obj extends Record<string, unknown>>(obj: Obj) {
  return class {
    data: Obj;
    constructor() {
      this.data = obj;
    }
  };
}

export class Person extends Dict({
  name: "hi",
  wrote: () => new Book(),
}) {}

export class Book extends Dict({
  name: "what",
}) {}

const p = new Person();
const a = p.data.wrote;
console.log({ p, a });
