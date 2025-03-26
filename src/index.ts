import { date, number, string, uuid } from "./columns/base-columns";
import type { Column } from "./columns/column";
import {
  defaultValue,
  type IsNullable,
  nullable,
  primaryKey,
} from "./columns/properties";
import { pipe } from "./pipe";
import { Table } from "./table";

const basicColumns = {
  id: pipe(uuid(), primaryKey),
  name: pipe(string()),
  createdAt: pipe(date(), defaultValue(new Date())),
  updatedAt: pipe(date(), defaultValue(new Date())),
};

class Book extends Table(
  "book",
  {
    ...basicColumns,
    authorId: string(),
    description: pipe(string(), defaultValue("what")),
    price: pipe(number(), nullable),
  },
) {}

type InferColumn<C> = C extends Column<any, infer T>
  ? IsNullable<C> extends true ? T | null : T
  : never;

type InferFields<CR extends Record<string, Column<any, any>>> = {
  [k in keyof CR]: InferColumn<CR[k]>;
};

export function makeTable<
  ColumnsRecord extends Record<string, Column<any, any>>,
>(columns: ColumnsRecord) {
  return {
    fields: columns,
  };
}

const Book2 = makeTable({
  ...basicColumns,
  authorId: string(),
  description: pipe(string(), defaultValue("what")),
  price: pipe(number(), nullable),
});

type Book2 = InferFields<typeof Book2["fields"]>;
