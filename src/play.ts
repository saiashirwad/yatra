interface PersonInstance {
  name: string;
  age: number;
  greet(): void;
}

interface PersonConstructor {
  new(name: string, age: number): PersonInstance;
}

function PersonFunction(this: PersonInstance, name: string, age: number) {
  this.name = name;
  this.age = age;
}

PersonFunction.prototype.greet = function(this: PersonInstance): void {
  console.log(`Hello, my name is ${this.name} and I am ${this.age} years old.`);
};

// --- Step 5: Bridge the Implementation and the Constructor Interface ---
// This is crucial! Assign your function implementation to a variable
// explicitly typed with the Constructor interface. This tells TypeScript
// that PersonFunction satisfies the 'new' signature requirement.
const Person: PersonConstructor = PersonFunction as any;

// --- Step 6: Usage ---
// Now you can use 'new Person(...)' and TypeScript understands it perfectly.
const person1 = new Person("Alice", 30);
const person2 = new Person("Bob", 25);

// Type checking works correctly on instances
console.log(person1.name); // Output: Alice
person2.greet(); // Output: Hello, my name is Bob and I am 25 years old.

// Type errors are caught
// person1.age = "thirty"; // Error: Type 'string' is not assignable to type 'number'.
// const person3 = new Person("Charlie", "unknown"); // Error: Argument of type 'string' is not assignable to parameter of type 'number'.
// person1.doSomething(); // Error: Property 'doSomething' does not exist on type 'PersonInstance'.
