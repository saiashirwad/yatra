// ----------------------------------------
// Minimal Types
// ----------------------------------------
type Predicate<T> = (item: T) => boolean;
type Selector<T, R> = (item: T) => R;

/**
 * The `from` function:
 * - Accepts an initial array `source`.
 * - Accepts a generator-based `pipeline` that yields operations.
 * - Runs those operations in sequence to produce a final typed result.
 */
function from<T, R>(
  source: T[],
  pipeline: (items: T[]) => Generator<any, R, T[]>,
): R {
  // Create the pipeline (a generator).
  const iterator = pipeline(source);
  // We'll keep track of the "current" data as the pipeline progresses.
  let current = source;

  while (true) {
    const { value, done } = iterator.next(current);

    if (done) {
      // The pipeline is finished, `value` is the final return.
      return value;
    }
    // In a more advanced implementation, you’d dispatch on `value` to see
    // which operation is requested. This minimal example just ignores it
    // because each operation *returns* the new data directly.
  }
}

/**
 * A minimal "where" operation using a generator.
 * Notice it returns a `T[]` array, so type inference flows naturally.
 */
function* whereOp<T>(
  items: T[],
  predicate: Predicate<T>,
): Generator<null, T[], T[]> {
  const filtered = items.filter(predicate);
  return filtered;
}

/**
 * A minimal "select" operation using a generator.
 * It maps items to a new type `R`, returning `R[]`.
 */
function* selectOp<T, R>(
  items: T[],
  selector: Selector<T, R>,
): Generator<null, R[], T[]> {
  const mapped = items.map(selector);
  return mapped;
}

// ----------------------------------------
// Usage Example
// ----------------------------------------
interface Person {
  name: string;
  age: number;
}

const people = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 40 },
  { name: "Carl", age: 20 },
];

const result = from(people, function*(ctx) {
  yield* whereOp(ctx, p => p.age > 25);
  return yield* selectOp(ctx, p => p.name);
});

console.log(result); // e.g. ["Alice", "Bob"]
