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
//   ^?

function* updates() {
  yield set({ hi: "there" });
  yield set({ name: "sai" });
  yield set({ age: 5 });
}

// ======= Query Builder Types =======

// Table definitions with typed columns
type TableSchema = Record<string, {
  columns: Record<string, ColumnType>;
}>;

type ColumnType = {
  type: "string" | "number" | "boolean" | "date";
  nullable?: boolean;
};

// Query builder types
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

// Type for selected result
type SelectedResult<
  Schema extends TableSchema,
  T extends keyof Schema,
  Selected extends keyof Schema[T]["columns"],
> = {
    [K in Selected]: Schema[T]["columns"][K]["nullable"] extends true
    ? Schema[T]["columns"][K]["type"] | null
    : Schema[T]["columns"][K]["type"];
  };

// Type for set operations
function selectFrom<
  Schema extends TableSchema,
  T extends keyof Schema,
>(table: T) {
  return {
    *[Symbol.iterator]() {
      yield set({ from: table });

      return {
        *select<const S extends readonly (keyof Schema[T]["columns"])[]>(...fields: S) {
          yield set({ select: fields });

          return {
            *where<const C extends Record<string, any>>(condition: C) {
              yield set({ where: condition });
              return {};
            },
          };
        },
        *where<const C extends Record<string, any>>(condition: C) {
          yield set({ where: condition });
          return {};
        },
        *orderBy<const O extends Record<string, any>>(orderBy: O) {
          yield set({ orderBy });
          return {};
        },
        *limit<const L extends number>(limit: L) {
          yield set({ limit });
          return {};
        },
      };
    },
  };
}

type MySchema = {
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

function buildQuery<T extends (...args: any[]) => any>(t: T): CleanResult<T> {
  return {} as any;
}

const example = buildQuery(function* () {
  const baseQuery = yield* selectFrom<MySchema, "posts">("posts");
  const withFields = yield* baseQuery.select("id", "title", "userId");
  yield* withFields.where({ published: true });
  yield* baseQuery.orderBy({ createdAt: "desc" });
});

typeof example;
//     ^?

