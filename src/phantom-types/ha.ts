class Entity<T extends Record<string, any>> {
  private data: T;

  declare _data: T;
  declare _nameType: T["name"];

  constructor(data: T) {
    this.data = data;
  }

  get name(): this["_nameType"] {
    return this.data["name"] as any;
  }
}

const person = new Entity(
  { name: "Alice", age: 30 } as const,
);
type nameType = (typeof person)["_nameType"];

console.log(person.name); // "Alice"
