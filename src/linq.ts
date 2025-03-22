/**
 * Type-Safe LINQ Implementation
 * Provides generator-based and fluent APIs with strong type safety
 */

// Type Utility Helpers
type Clean<T> = { [K in keyof T]: T[K] } & unknown;

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends
    (k: infer I) => void ? I
    : never;

type GeneratorResult<R> = R extends
  Generator<infer V, any, any> ? V : never;

type CleanResult<T extends (...args: any[]) => any> = Clean<
  UnionToIntersection<GeneratorResult<ReturnType<T>>>
>;

// Helper function to set result values for generators
function set<const R>(r: R) {
  return r;
}

// Type definitions for query elements
type Selector<T, R> = (item: T, index: number) => R;
type Predicate<T> = (item: T, index: number) => boolean;
type KeySelector<T, K> = (item: T) => K;
type ElementSelector<T, V> = (item: T) => V;

// Group interface with strongly typed key and values
interface Group<K, T> {
  readonly key: K;
  readonly values: readonly T[];
}

/**
 * Main Query interface with comprehensive type safety
 */
interface Query<T> extends Iterable<T> {
  // Transformation operations
  select<R>(selector: Selector<T, R>): Query<R>;
  selectMany<R>(
    selector: (item: T, index: number) => Iterable<R>,
  ): Query<R>;

  // Filtering operations
  where(predicate: Predicate<T>): Query<T>;

  // Ordering operations
  orderBy<K>(keySelector: KeySelector<T, K>): Query<T>;
  orderByDescending<K>(
    keySelector: KeySelector<T, K>,
  ): Query<T>;

  // Element operations
  first(): T;
  first(predicate: Predicate<T>): T;
  firstOrDefault(defaultValue: T): T;
  firstOrDefault(
    defaultValue: T,
    predicate: Predicate<T>,
  ): T;
  last(): T;
  last(predicate: Predicate<T>): T;
  lastOrDefault(defaultValue: T): T;
  lastOrDefault(
    defaultValue: T,
    predicate: Predicate<T>,
  ): T;

  // Grouping operations
  groupBy<K>(
    keySelector: KeySelector<T, K>,
  ): Query<Group<K, T>>;

  // Aggregation operations
  count(): number;
  count(predicate: Predicate<T>): number;
  sum(selector: (item: T) => number): number;
  average(selector: (item: T) => number): number;

  // Take/skip operations
  take(count: number): Query<T>;
  skip(count: number): Query<T>;

  // Conversion operations
  toArray(): readonly T[];
  toDictionary<K, V>(
    keySelector: KeySelector<T, K>,
    valueSelector: ElementSelector<T, V>,
  ): ReadonlyMap<K, V>;
}

/**
 * Creates a query object from an iterable source with strong type safety
 */
export function from<T>(source: Iterable<T>): Query<T>;

/**
 * Creates a query result using a pipeline with strong type inference
 */
export function from<T, R>(
  source: Iterable<T>,
  pipeline: (ctx: Iterable<T>) => Generator<any, R, any>,
): R;

/**
 * Implementation of the from function with proper type handling
 */
export function from<T, R>(
  source: Iterable<T>,
  pipeline?: (ctx: Iterable<T>) => Generator<any, R, any>,
): Query<T> | R {
  if (pipeline) {
    // Pipeline version with proper context tracking
    const generator = pipeline(source);
    let result: Record<string, unknown> = {};
    let next = generator.next();
    let context: unknown = source;

    // Process the pipeline
    while (!next.done) {
      if (typeof next.value === "function") {
        context = next.value(context);
      } else {
        // Collect operation descriptors
        result = { ...result, ...next.value };
      }
      next = generator.next(context as any);
    }

    // If the generator returns a value, use it
    if (next.value !== undefined) {
      return next.value;
    }

    // Execute operations based on collected result
    let finalResult = context as any;

    // Apply operations in the right order
    if (result.select && Array.isArray(finalResult)) {
      finalResult = finalResult.map((
        item: any,
        index: number,
      ) =>
        typeof result.select === "function"
          ? (result.select as Function)(item, index)
          : item
      );
    }

    return finalResult;
  }

  // Standard version - return a type-safe Query object
  return new ArrayQuery<T>(source);
}

/**
 * Generator-based operations for pipeline composition
 * Each generator maintains precise type information
 */

export function* select<T, R>(
  context: Iterable<T>,
  selector: Selector<T, R>,
): Generator<
  { select: typeof selector },
  Iterable<R>,
  any
> {
  yield set({ select: selector });

  // Execute the operation with type safety
  const result: R[] = [];
  let index = 0;
  for (const item of context) {
    result.push(selector(item, index++));
  }
  return result;
}

export function* selectMany<T, R>(
  context: Iterable<T>,
  selector: (item: T, index: number) => Iterable<R>,
): Generator<
  { selectMany: typeof selector },
  Iterable<R>,
  any
> {
  yield set({ selectMany: selector });

  // Execute the operation
  const result: R[] = [];
  let index = 0;
  for (const item of context) {
    const collection = selector(item, index++);
    for (const nestedItem of collection) {
      result.push(nestedItem);
    }
  }
  return result;
}

export function* where<T>(
  context: Iterable<T>,
  predicate: Predicate<T>,
): Generator<
  { where: typeof predicate },
  Iterable<T>,
  any
> {
  yield set({ where: predicate });

  // Execute the operation
  const result: T[] = [];
  let index = 0;
  for (const item of context) {
    if (predicate(item, index++)) {
      result.push(item);
    }
  }
  return result;
}

export function* orderBy<T, K>(
  context: Iterable<T>,
  keySelector: KeySelector<T, K>,
): Generator<
  { orderBy: typeof keySelector },
  Iterable<T>,
  any
> {
  yield set({ orderBy: keySelector });

  // Execute the operation
  const array = [...context];
  array.sort((a, b) => {
    const keyA = keySelector(a);
    const keyB = keySelector(b);
    if (keyA < keyB) return -1;
    if (keyA > keyB) return 1;
    return 0;
  });
  return array;
}

export function* orderByDescending<T, K>(
  context: Iterable<T>,
  keySelector: KeySelector<T, K>,
): Generator<
  { orderByDescending: typeof keySelector },
  Iterable<T>,
  any
> {
  yield set({ orderByDescending: keySelector });

  // Execute the operation
  const array = [...context];
  array.sort((a, b) => {
    const keyA = keySelector(a);
    const keyB = keySelector(b);
    if (keyA > keyB) return -1;
    if (keyA < keyB) return 1;
    return 0;
  });
  return array;
}

// Additional type-safe generator operations

export function* first<T>(
  context: Iterable<T>,
  predicate?: Predicate<T>,
): Generator<{ first: typeof predicate }, T, any> {
  yield set({ first: predicate });

  // Execute the operation
  let index = 0;
  for (const item of context) {
    if (!predicate || predicate(item, index++)) {
      return item;
    }
  }
  throw new Error("Sequence contains no matching elements");
}

export function* firstOrDefault<T>(
  context: Iterable<T>,
  defaultValue: T,
  predicate?: Predicate<T>,
): Generator<
  {
    firstOrDefault: {
      defaultValue: T;
      predicate: typeof predicate;
    };
  },
  T,
  any
> {
  yield set({
    firstOrDefault: { defaultValue, predicate },
  });

  // Execute the operation
  try {
    let index = 0;
    for (const item of context) {
      if (!predicate || predicate(item, index++)) {
        return item;
      }
    }
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

export function* last<T>(
  context: Iterable<T>,
  predicate?: Predicate<T>,
): Generator<{ last: typeof predicate }, T, any> {
  yield set({ last: predicate });

  // Execute the operation
  let lastItem: T | undefined;
  let found = false;
  let index = 0;

  for (const item of context) {
    if (!predicate || predicate(item, index++)) {
      lastItem = item;
      found = true;
    }
  }

  if (!found) {
    throw new Error(
      "Sequence contains no matching elements",
    );
  }

  return lastItem as T;
}

export function* lastOrDefault<T>(
  context: Iterable<T>,
  defaultValue: T,
  predicate?: Predicate<T>,
): Generator<
  {
    lastOrDefault: {
      defaultValue: T;
      predicate: typeof predicate;
    };
  },
  T,
  any
> {
  yield set({ lastOrDefault: { defaultValue, predicate } });

  // Execute the operation with type safety
  try {
    let lastItem: T | undefined;
    let found = false;
    let index = 0;

    for (const item of context) {
      if (!predicate || predicate(item, index++)) {
        lastItem = item;
        found = true;
      }
    }

    if (!found) {
      return defaultValue;
    }

    return lastItem as T;
  } catch {
    return defaultValue;
  }
}

export function* groupBy<T, K>(
  context: Iterable<T>,
  keySelector: KeySelector<T, K>,
): Generator<
  { groupBy: typeof keySelector },
  Iterable<Group<K, T>>,
  any
> {
  yield set({ groupBy: keySelector });

  // Execute the operation
  const groups = new Map<K, T[]>();

  for (const item of context) {
    const key = keySelector(item);
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(item);
  }

  const result: Group<K, T>[] = [];
  groups.forEach((values, key) => {
    result.push({ key, values });
  });

  return result;
}

export function* count<T>(
  context: Iterable<T>,
  predicate?: Predicate<T>,
): Generator<{ count: typeof predicate }, number, any> {
  yield set({ count: predicate });

  // Execute the operation
  let count = 0;
  let index = 0;
  for (const item of context) {
    if (!predicate || predicate(item, index++)) {
      count++;
    }
  }
  return count;
}

export function* sum<T>(
  context: Iterable<T>,
  selector: (item: T) => number,
): Generator<{ sum: typeof selector }, number, any> {
  yield set({ sum: selector });

  // Execute the operation
  let sum = 0;
  for (const item of context) {
    sum += selector(item);
  }
  return sum;
}

export function* average<T>(
  context: Iterable<T>,
  selector: (item: T) => number,
): Generator<{ average: typeof selector }, number, any> {
  yield set({ average: selector });

  // Execute the operation
  let sum = 0;
  let count = 0;

  for (const item of context) {
    sum += selector(item);
    count++;
  }

  if (count === 0) {
    throw new Error("Sequence contains no elements");
  }

  return sum / count;
}

export function* take<T>(
  context: Iterable<T>,
  count: number,
): Generator<{ take: number }, Iterable<T>, any> {
  yield set({ take: count });

  // Execute the operation
  const result: T[] = [];
  let taken = 0;
  for (const item of context) {
    if (taken >= count) break;
    result.push(item);
    taken++;
  }
  return result;
}

export function* skip<T>(
  context: Iterable<T>,
  count: number,
): Generator<{ skip: number }, Iterable<T>, any> {
  yield set({ skip: count });

  // Execute the operation
  const result: T[] = [];
  let skipped = 0;
  for (const item of context) {
    if (skipped < count) {
      skipped++;
      continue;
    }
    result.push(item);
  }
  return result;
}

export function* toArray<T>(
  context: Iterable<T>,
): Generator<{ toArray: true }, readonly T[], any> {
  yield set({ toArray: true });

  // Execute the operation
  return [...context] as const;
}

export function* toDictionary<T, K, V>(
  context: Iterable<T>,
  keySelector: KeySelector<T, K>,
  valueSelector: ElementSelector<T, V>,
): Generator<
  {
    toDictionary: {
      keySelector: typeof keySelector;
      valueSelector: typeof valueSelector;
    };
  },
  ReadonlyMap<K, V>,
  any
> {
  yield set({
    toDictionary: { keySelector, valueSelector },
  });

  // Execute the operation
  const map = new Map<K, V>();
  for (const item of context) {
    map.set(keySelector(item), valueSelector(item));
  }
  return map as ReadonlyMap<K, V>;
}

/**
 * Type-safe implementation of the Query interface
 */
class ArrayQuery<T> implements Query<T> {
  private readonly source: Iterable<T>;

  constructor(source: Iterable<T>) {
    this.source = source;
  }

  *[Symbol.iterator](): Iterator<T> {
    yield* this.source;
  }

  select<R>(selector: Selector<T, R>): Query<R> {
    const result: R[] = [];
    let index = 0;
    for (const item of this.source) {
      result.push(selector(item, index++));
    }
    return new ArrayQuery<R>(result);
  }

  selectMany<R>(
    selector: (item: T, index: number) => Iterable<R>,
  ): Query<R> {
    const result: R[] = [];
    let index = 0;
    for (const item of this.source) {
      const collection = selector(item, index++);
      for (const nestedItem of collection) {
        result.push(nestedItem);
      }
    }
    return new ArrayQuery<R>(result);
  }

  where(predicate: Predicate<T>): Query<T> {
    const result: T[] = [];
    let index = 0;
    for (const item of this.source) {
      if (predicate(item, index++)) {
        result.push(item);
      }
    }
    return new ArrayQuery<T>(result);
  }

  orderBy<K>(keySelector: KeySelector<T, K>): Query<T> {
    const array = [...this.source];
    array.sort((a, b) => {
      const keyA = keySelector(a);
      const keyB = keySelector(b);
      if (keyA < keyB) return -1;
      if (keyA > keyB) return 1;
      return 0;
    });
    return new ArrayQuery(array);
  }

  orderByDescending<K>(
    keySelector: KeySelector<T, K>,
  ): Query<T> {
    const array = [...this.source];
    array.sort((a, b) => {
      const keyA = keySelector(a);
      const keyB = keySelector(b);
      if (keyA > keyB) return -1;
      if (keyA < keyB) return 1;
      return 0;
    });
    return new ArrayQuery(array);
  }

  first(): T;
  first(predicate?: Predicate<T>): T {
    let index = 0;
    for (const item of this.source) {
      if (!predicate || predicate(item, index++)) {
        return item;
      }
    }
    throw new Error(
      "Sequence contains no matching elements",
    );
  }

  firstOrDefault(defaultValue: T): T;
  firstOrDefault(
    defaultValue: T,
    predicate?: Predicate<T>,
  ): T {
    try {
      return predicate
        ? this.first(predicate)
        : this.first();
    } catch {
      return defaultValue;
    }
  }

  last(): T;
  last(predicate?: Predicate<T>): T {
    let lastItem: T | undefined;
    let found = false;
    let index = 0;

    for (const item of this.source) {
      if (!predicate || predicate(item, index++)) {
        lastItem = item;
        found = true;
      }
    }

    if (!found) {
      throw new Error(
        "Sequence contains no matching elements",
      );
    }

    return lastItem as T;
  }

  lastOrDefault(defaultValue: T): T;
  lastOrDefault(
    defaultValue: T,
    predicate?: Predicate<T>,
  ): T {
    try {
      return predicate ? this.last(predicate) : this.last();
    } catch {
      return defaultValue;
    }
  }

  groupBy<K>(
    keySelector: KeySelector<T, K>,
  ): Query<Group<K, T>> {
    const groups = new Map<K, T[]>();

    for (const item of this.source) {
      const key = keySelector(item);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    const result: Group<K, T>[] = [];
    groups.forEach((values, key) => {
      result.push({ key, values });
    });

    return new ArrayQuery(result);
  }

  count(): number;
  count(predicate?: Predicate<T>): number {
    let count = 0;
    let index = 0;
    for (const item of this.source) {
      if (!predicate || predicate(item, index++)) {
        count++;
      }
    }
    return count;
  }

  sum(selector: (item: T) => number): number {
    let sum = 0;
    for (const item of this.source) {
      sum += selector(item);
    }
    return sum;
  }

  average(selector: (item: T) => number): number {
    let sum = 0;
    let count = 0;

    for (const item of this.source) {
      sum += selector(item);
      count++;
    }

    if (count === 0) {
      throw new Error("Sequence contains no elements");
    }

    return sum / count;
  }

  take(count: number): Query<T> {
    const result: T[] = [];
    let taken = 0;
    for (const item of this.source) {
      if (taken >= count) break;
      result.push(item);
      taken++;
    }
    return new ArrayQuery<T>(result);
  }

  skip(count: number): Query<T> {
    const result: T[] = [];
    let skipped = 0;
    for (const item of this.source) {
      if (skipped < count) {
        skipped++;
        continue;
      }
      result.push(item);
    }
    return new ArrayQuery<T>(result);
  }

  toArray(): readonly T[] {
    return [...this.source] as const;
  }

  toDictionary<K, V>(
    keySelector: KeySelector<T, K>,
    valueSelector: ElementSelector<T, V>,
  ): ReadonlyMap<K, V> {
    const map = new Map<K, V>();
    for (const item of this.source) {
      map.set(keySelector(item), valueSelector(item));
    }
    return map as ReadonlyMap<K, V>;
  }
}

/**
 * Create a type-safe query result by combining all yielded operation descriptors
 * Ensures perfect type inference for the composed query
 */
export function query<T extends (...args: any[]) => any>(
  pipeline: T,
): CleanResult<T> {
  return {} as any; // Type-level only, no runtime implementation needed
}

// Usage example with type inference
interface Person {
  id: number;
  name: string;
  age: number;
  city: string;
}

const people: readonly Person[] = [
  { id: 1, name: "Alice", age: 25, city: "New York" },
  { id: 2, name: "Bob", age: 30, city: "San Francisco" },
  { id: 3, name: "Charlie", age: 35, city: "New York" },
  { id: 4, name: "Diana", age: 40, city: "Chicago" },
  { id: 5, name: "Eve", age: 45, city: "San Francisco" },
];

// Example using generator-based query with perfect type inference
type PersonNameAge = { name: string; age: number };

const example = from(people, function*(ctx) {
  ctx = yield* orderBy(ctx, p => p.age);
  ctx = yield* take(ctx, 2);
  return yield* select(ctx, p => ({
    name: p.name,
    age: p.age,
  } as const));
});

// The result is correctly typed as an array of PersonNameAge
const resultType: readonly PersonNameAge[] = example;

// Example using fluent API with type safety
const fluentExample = from(people)
  .orderBy(p => p.age)
  .take(2)
  .select(p => ({
    name: p.name,
    age: p.age,
  } as const))
  .toArray();

// Static type verification with query helper
const typeSafeQuery = query(function*() {
  const ctx = people;
  yield* orderBy(ctx, p => p.age);
  yield* take(ctx, 2);
  yield* select(ctx, p => ({
    name: p.name,
    age: p.age,
  } as const));
});

// Type is statically inferred from operations
type QueryResult = typeof typeSafeQuery;
// QueryResult is inferred as { orderBy: Function, take: number, select: Function }
