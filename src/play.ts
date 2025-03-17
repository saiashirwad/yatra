type Clean<T> = { [k in keyof T]: T[k] } & unknown;

function set<const R>(r: R) {
  return r;
}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void ? I
  : never;

type GeneratorResult<R> = R extends Generator<infer V, any, any> ? V : never;

type CleanResult<T extends (...args: any[]) => any> = Clean<
  UnionToIntersection<GeneratorResult<ReturnType<T>>>
>;

type Result = CleanResult<typeof updates>;

function* updates() {
  yield set({ hi: "there" });
  yield set({ name: "sai" });
  yield set({ age: 5 });
}

type TableSchema = Record<string, {
  columns: Record<string, ColumnType>;
}>;

type ColumnType = {
  type: "string" | "number" | "boolean" | "date";
  nullable?: boolean;
};

type SelectQuery<
  Schema extends TableSchema,
  T extends keyof Schema,
  Selected extends keyof Schema[T]["columns"] = never,
  Conditions = never,
  Joins = never,
  OrderBys = never,
  LimitValue = never,
> = {
  select?: Selected[];
  from: T;
  where?: Conditions;
  joins?: Joins;
  orderBy?: OrderBys;
  limit?: LimitValue;
};

type SelectedResult<
  Schema extends TableSchema,
  T extends keyof Schema,
  Selected extends keyof Schema[T]["columns"],
> = {
    [K in Selected]: Schema[T]["columns"][K]["nullable"] extends true
    ? Schema[T]["columns"][K]["type"] | null
    : Schema[T]["columns"][K]["type"];
  };

let currentQueryContext: any = null;

type QueryContext<Schema extends TableSchema, T extends keyof Schema> = {
  schema: Schema;
  table: T;
  query: any;
};

function* selectFrom<Schema extends TableSchema, T extends keyof Schema>(
  table: T
) {
  const context: QueryContext<Schema, T> = {
    schema: {} as Schema,
    table,
    query: { from: table }
  };
  currentQueryContext = context;
  yield set({ from: table });
  return context;
}

function* select<
  Schema extends TableSchema,
  T extends keyof Schema,
  S extends readonly (keyof Schema[T]["columns"])[]
>(context: QueryContext<Schema, T>, fields: S) {
  yield set({ select: fields });
  currentQueryContext = { ...context, fields };
  return currentQueryContext;
}

function* where<
  Schema extends TableSchema,
  T extends keyof Schema,
  C extends Record<string, any>
>(context: QueryContext<Schema, T>, condition: C) {
  yield set({ where: condition });
  return context;
}

function* orderBy<
  Schema extends TableSchema,
  T extends keyof Schema,
  O extends Record<string, any>
>(context: QueryContext<Schema, T>, orderBy: O) {
  yield set({ orderBy });
  return context;
}

function* limit<
  Schema extends TableSchema,
  T extends keyof Schema,
  L extends number
>(context: QueryContext<Schema, T>, limit: L) {
  yield set({ limit });
  return context;
}

type CurrentSchema = typeof currentQueryContext extends {
  schema: infer S,
  table: infer T
} ? S[T & keyof S] : never;

type TestSchema = {
  users: {
    columns: {
      id: { type: "number" };
      name: { type: "string" };
      email: { type: "string" };
      createdAt: { type: "date" };
    };
  };
  posts: {
    columns: {
      id: { type: "number" };
      title: { type: "string" };
      content: { type: "string" };
      userId: { type: "number" };
      published: { type: "boolean" };
    };
  };
};

function query<T extends (...args: any[]) => any>(t: T): CleanResult<T> {
  return {} as any;
}

const example = query(function* () {
  const ctx = yield* selectFrom<TestSchema, "posts">("posts");
  yield* select(ctx, ["id", "title", "content"]);
  yield* where(ctx, { published: true });
  yield* orderBy(ctx, { createdAt: "desc" });
});

typeof example;
//     ^?
