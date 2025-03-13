type Class<O extends Record<string, unknown>> = {
  new (): InstanceType<new () => O>;
};

function Dict<const O extends Record<string, unknown>>(obj: O) {
  return class {
    constructor() {
      Object.assign(this, obj);
    }
  } as Class<O>;
}

function member<
  T extends new (...args: any[]) => any,
  Instance extends InstanceType<T>,
  K extends keyof Instance,
>(cls: T, key: K): Instance[K] {
  return new cls()[key];
}

export class Person extends Dict({
  name: "hi",
  wrote: () => Book,
}) {}

const haha = member(Person, "name");

export class Book extends Dict({
  name: "what",
  otherBooks: () => new Array<Book>(),
  ownedBy: () => member(Person, "name"),
}) {}

export class Something extends Dict({
  name: "something",
  age: 2,
  owner: () => Person,
}) {}

const b = new Book();
console.log(b.name);
