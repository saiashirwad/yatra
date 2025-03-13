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
>(class_: T, key: K): Instance[K] {
  return new class_()[key];
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

type ModelMap = {
  person: typeof Person;
  book: typeof Book;
  something: typeof Something;
};

const ModelMapValues: ModelMap = {
  person: Person,
  book: Book,
  something: Something,
};

type ModelType = keyof ModelMap;

function createModel<T extends ModelType>(
  type: T,
  data?: Partial<InstanceType<ModelMap[T]>>,
): InstanceType<ModelMap[T]> {
  const instance = new ModelMapValues[type]() as InstanceType<ModelMap[T]>;
  if (data) {
    Object.assign(instance, data);
  }
  return instance;
}

const newBook = createModel("book", { name: "what" });
const what = createModel("person", {
  name: "hi",
  wrote: () => Book,
});
