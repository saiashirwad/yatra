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

function* selectFrom<Schema extends TableSchema, T extends keyof Schema>(
  table: T
) {
  const context = { schema: {} as Schema, table, query: { from: table } };
  currentQueryContext = context;
  yield set({ from: table });
  return context;
}

function* select<
  S extends readonly (keyof CurrentSchema["columns"])[]
>(...fields: S) {
  if (!currentQueryContext) throw new Error("select must be called after selectFrom");
  const context = currentQueryContext;
  yield set({ select: fields });
  currentQueryContext = { ...context, fields };
  return currentQueryContext;
}

function* where<const C extends Record<string, any>>(condition: C) {
  if (!currentQueryContext) throw new Error("where must be called after selectFrom or select");
  yield set({ where: condition });
  return currentQueryContext;
}

function* orderBy<const O extends Record<string, any>>(orderBy: O) {
  if (!currentQueryContext) throw new Error("orderBy must be called after selectFrom or select");
  yield set({ orderBy });
  return currentQueryContext;
}

function* limit<const L extends number>(limit: L) {
  if (!currentQueryContext) throw new Error("limit must be called after selectFrom or select");
  yield set({ limit });
  return currentQueryContext;
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
  yield* selectFrom<TestSchema, "posts">("posts");
  yield* select("id", "title", "content");
  yield* where({ published: true });
  yield* orderBy({ createdAt: "desc" });
});

typeof example;
//     ^?
