type Clean<T> =
  & { [k in keyof T]: T[k] }
  & unknown;

function set<const R>(r: R) {
  return r;
}

type UnionToIntersection<U> =
  (U extends any ? (k: U) => void : never) extends
    (
      k: infer I,
    ) => void ? I
    : never;

type GeneratorResult<R> = R extends
  Generator<infer V> ? V
  : never;

type CleanResult<
  T extends (...args: any[]) => any,
> = Clean<
  UnionToIntersection<
    GeneratorResult<ReturnType<T>>
  >
>;

type TableSchema = Record<
  string,
  {
    columns: Record<string, any>;
  }
>;

let currentQueryContext: any = null;

type QueryContext<
  Schema extends TableSchema,
  T extends keyof Schema,
> = {
  schema: Schema;
  table: T;
  query: any;
};

function* select<
  Schema extends TableSchema,
  T extends keyof Schema,
  const S extends readonly (keyof Schema[T][
    "columns"
  ])[],
>(
  context: QueryContext<Schema, T>,
  fields: S,
): Generator<{ select: S }> {
  yield set({ select: fields });
  currentQueryContext = { ...context, fields };
  return currentQueryContext;
}

function* where<
  Schema extends TableSchema,
  T extends keyof Schema,
  const C extends Record<string, any>,
>(
  context: QueryContext<Schema, T>,
  condition: C,
): Generator<{ where: C }> {
  yield set({ where: condition });
  return context;
}

function* orderBy<
  Schema extends TableSchema,
  T extends keyof Schema,
  const O extends Record<string, any>,
>(
  context: QueryContext<Schema, T>,
  orderByVal: O,
): Generator<{ orderBy: O }> {
  yield set({ orderBy: orderByVal });
  return context;
}

function* limit<
  Schema extends TableSchema,
  T extends keyof Schema,
  const L extends number,
>(
  context: QueryContext<Schema, T>,
  limitVal: L,
): Generator<{ limit: L }> {
  yield set({ limit: limitVal });
  return context;
}

type TestSchema = {
  users: {
    columns: {
      id: number;
      name: string;
      email: string;
      createdAt: Date;
    };
  };
  posts: {
    columns: {
      id: number;
      title: string;
      content: string;
      userId: number;
      published: boolean;
    };
  };
};

function query<T extends (...args: any[]) => any>(
  t: T,
): CleanResult<T> {
  return {} as any;
}

function createDb<Schema extends TableSchema>(
  schema: Schema,
) {
  return {
    selectFrom<T extends keyof Schema>(table: T) {
      function* _selectFrom() {
        const context: QueryContext<Schema, T> = {
          schema,
          table,
          query: { from: table },
        };
        currentQueryContext = context;
        yield set({ from: table });
        return context;
      }

      return _selectFrom();
    },
  };
}
const db = createDb<TestSchema>({} as TestSchema);

const example = query(function*() {
  const ctx = yield* db.selectFrom("posts");
  yield* select(ctx, ["id", "content", "title"]);
  yield* where(ctx, { published: true });
  yield* orderBy(ctx, { createdAt: "desc" });
});

typeof example;
//     ^?
//

function add(a: number, b: number) {
  return a + b;
}
