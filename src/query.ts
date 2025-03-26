// query-builder.ts
import { Column } from "./columns/column";
import { TableFields, TableName } from "./types";

// Utility types
type Clean<T> = { [k in keyof T]: T[k] } & unknown;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
  k: infer I,
) => void ? I
  : never;

type GeneratorResult<R> = R extends Generator<infer V> ? V : never;

type CleanResult<T extends (...args: any[]) => any> = Clean<
  UnionToIntersection<GeneratorResult<ReturnType<T>>>
>;

// Helper function to preserve literal types
function set<const R>(r: R) {
  return r;
}

// Type constraint for table classes
type TableClass = {
  prototype: {
    [TableFields]: Record<string, Column<any, any>>;
    [TableName]: string;
  };
};

// Query context type based on a table class
type TableQueryContext<T extends TableClass> = {
  tableClass: T;
  columns: Record<string, Column<any, any>>;
  query: any;
};

// Create a initial query context from a table class
function from<T extends TableClass>(
  tableClass: T,
): TableQueryContext<T> {
  return {
    tableClass,
    columns: tableClass.prototype[TableFields],
    query: { from: tableClass.prototype[TableName] },
  };
}

// Select operation
function* select<
  T extends TableClass,
  const S extends ReadonlyArray<
    keyof T["prototype"][typeof TableFields] & string
  >,
>(
  context: TableQueryContext<T>,
  fields: S,
): Generator<{ select: S }, TableQueryContext<T>, any> {
  yield set({ select: fields });
  return {
    ...context,
    query: { ...context.query, select: fields },
  };
}

// Where operation
function* where<
  T extends TableClass,
  const C extends {
    [K in keyof T["prototype"][typeof TableFields]]?: any;
  },
>(
  context: TableQueryContext<T>,
  condition: C,
): Generator<{ where: C }, TableQueryContext<T>, any> {
  yield set({ where: condition });
  return {
    ...context,
    query: { ...context.query, where: condition },
  };
}

// Function to execute and collect the generator results
function buildQuery<T extends (...args: any[]) => Generator<any, any, any>>(
  gen: T,
): CleanResult<T> {
  const generator = gen();
  let result: any = {};

  let next = generator.next();
  while (!next.done) {
    result = { ...result, ...next.value };
    next = generator.next();
  }

  return result;
}

// Create a pipe-friendly version of the operations
const selectFrom = <T extends TableClass>(tableClass: T) => from(tableClass);

const withSelect = <
  T extends TableClass,
  S extends ReadonlyArray<keyof T["prototype"][typeof TableFields] & string>,
>(
  fields: S,
) =>
(context: TableQueryContext<T>) => buildQuery(() => select(context, fields));

const withWhere = <
  T extends TableClass,
  C extends { [K in keyof T["prototype"][typeof TableFields]]?: any },
>(
  condition: C,
) =>
(context: TableQueryContext<T>) => buildQuery(() => where(context, condition));

// Export everything
export {
  buildQuery,
  from,
  select,
  selectFrom,
  type TableQueryContext,
  where,
  withSelect,
  withWhere,
};
