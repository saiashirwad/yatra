type Class<O extends Record<string, unknown>> = new () => {
  [K in keyof O]: O[K];
};

function Dict<const O extends Record<string, unknown>>(obj: O) {
  return class {
    constructor() {
      Object.assign(this, obj);
    }
  } as Class<O>;
}

export class Person extends Dict({
  name: "hi",
  wrote: () => Book,
}) {}

export class Book extends Dict({
  name: "what",
  otherBooks: () => new Array<Book>(),
  ownedBy: () => Person,
}) {}

export class Something extends Dict({
  name: "something",
  age: 2,
  owner: () => Person,
}) {}

const b = new Book();
console.log(b.name);
