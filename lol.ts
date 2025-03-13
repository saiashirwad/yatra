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

const ModelMap = {
  person: Person,
  book: Book,
  something: Something,
} as const;

type ModelMap = typeof ModelMap;

type ModelType = keyof ModelMap;

type ModelDataType<T> = {
  [K in keyof T]: T[K] extends () => infer R
    ? R extends new () => any
      ? Partial<InstanceType<R>>
      : T[K]
    : T[K];
};

// function model<T extends ModelType>(
//   type: T,
//   data?: Partial<InstanceType<ModelMap[T]>>,
// ): InstanceType<ModelMap[T]> {
//   const instance = new ModelMap[type]() as InstanceType<ModelMap[T]>;
//   if (data) {
//     Object.assign(instance, data);
//   }
//   return instance;
// }

function model<T extends ModelType>(
  type: T,
  data?: ModelDataType<InstanceType<ModelMap[T]>>,
): InstanceType<ModelMap[T]> {
  const instance = new ModelMap[type]() as InstanceType<ModelMap[T]>;
  if (data) {
    // Handle nested models
    const processedData = Object.entries(data).reduce((acc, [key, value]) => {
      const propertyType = instance[key];
      if (
        typeof propertyType === "function" &&
        propertyType.prototype?.constructor
      ) {
        // If it's a model reference, create an instance
        acc[key] = model(key as ModelType, value as any);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    Object.assign(instance, processedData);
  }
  return instance;
}

const what = model("something", {
  name: "something",
  age: 2,
  owner: {
    name: "hi",
  },
});

console.log(what);
