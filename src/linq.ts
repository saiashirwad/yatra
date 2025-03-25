type Predicate<T> = (item: T) => boolean;
type Selector<T, R> = (item: T) => R;

type Clean<T> = { [k in keyof T]: T[k] } & unknown;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

type GeneratorResult<R> = R extends Generator<infer V> ? V
  : never;

type CleanResult<T extends (...args: any[]) => any> = Clean<
  UnionToIntersection<GeneratorResult<ReturnType<T>>>
>;

function set<const R>(r: R) {
  return r;
}

type QueryContext<T> = {
  data: T[];

  where: (predicate: Predicate<T>) => Generator<
    { type: "where"; predicate: Predicate<T>; result: T[] },
    QueryContext<T>,
    any
  >;

  select: <R>(selector: Selector<T, R>) => Generator<
    {
      type: "select";
      selector: Selector<T, R>;
      result: R[];
    },
    QueryContext<R>,
    any
  >;

  pickProps: <K extends keyof T>(keys: K[]) => Generator<
    { type: "pick"; keys: K[]; result: Pick<T, K>[] },
    QueryContext<Pick<T, K>>,
    any
  >;

  orderBy: <K extends keyof T>(
    key: K,
    direction?: "asc" | "desc",
  ) => Generator<
    {
      type: "orderBy";
      key: K;
      direction: "asc" | "desc";
      result: T[];
    },
    QueryContext<T>,
    any
  >;

  limit: (count: number) => Generator<
    { type: "limit"; count: number; result: T[] },
    QueryContext<T>,
    any
  >;

  groupBy: <K extends keyof T>(key: K) => Generator<
    {
      type: "groupBy";
      key: K;
      result: Record<string, T[]>;
    },
    Record<string, T[]>,
    any
  >;
};

function createContext<T>(data: T[]): QueryContext<T> {
  return {
    data,

    *where(predicate: Predicate<T>) {
      const filtered = data.filter(predicate);
      yield set({
        type: "where",
        predicate,
        result: filtered,
      });
      return createContext(filtered);
    },

    *select<R>(selector: Selector<T, R>) {
      const mapped = data.map(selector);
      yield set({
        type: "select",
        selector,
        result: mapped,
      });
      return createContext(mapped);
    },

    *pickProps<K extends keyof T>(keys: K[]) {
      const picked = data.map(item => {
        const result = {} as Pick<T, K>;
        for (const key of keys) {
          result[key] = item[key];
        }
        return result;
      });
      yield set({
        type: "pick",
        keys,
        result: picked,
      });
      return createContext(picked);
    },

    *orderBy<K extends keyof T>(
      key: K,
      direction: "asc" | "desc" = "asc",
    ) {
      const sorted = [...data].sort((a, b) => {
        const valueA = a[key];
        const valueB = b[key];

        if (valueA === valueB) return 0;

        const comparison = valueA < valueB ? -1 : 1;
        return direction === "asc"
          ? comparison
          : -comparison;
      });
      yield set({
        type: "orderBy",
        key,
        direction,
        result: sorted,
      });
      return createContext(sorted);
    },

    *limit(count: number) {
      const limited = data.slice(0, count);
      yield set({
        type: "limit",
        count,
        result: limited,
      });
      return createContext(limited);
    },

    *groupBy<K extends keyof T>(key: K) {
      const grouped = data.reduce((acc, item) => {
        const keyValue = String(item[key]);
        if (!acc[keyValue]) {
          acc[keyValue] = [];
        }
        acc[keyValue].push(item);
        return acc;
      }, {} as Record<string, T[]>);
      yield set({
        type: "groupBy",
        key,
        result: grouped,
      });
      return grouped;
    },
  };
}

function from<T, R>(
  source: T[],
  pipeline: (
    ctx: QueryContext<T>,
  ) => Generator<any, R, any>,
): R {
  const ctx = createContext(source);
  const iterator = pipeline(ctx);
  let current: any = ctx;

  let next = iterator.next();
  while (!next.done) {
    const value = next.value;

    if (
      value && typeof value === "object"
      && "result" in value
    ) {
    }

    next = iterator.next(current);
  }

  return next.value !== undefined
    ? next.value
    : current.data as unknown as R;
}

function query<T extends (...args: any[]) => any>(
  t: T,
): CleanResult<T> {
  return {} as any;
}

const people = [
  { name: "Alice", age: 30, department: "Engineering" },
  {
    name: "Bob",
    age: 40,
    department: "Marketing",
    hobby: "programming",
  },
  {
    name: "Carl",
    age: 20,
    department: "Engineering",
    hobby: "cooking",
  },
];

from(people, function*(ctx) {
  yield* ctx.pickProps(["name", "age"]);
  yield* ctx.where(p => p.age > 25);
});
