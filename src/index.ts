import { date, number, string, uuid } from "./columns/base-columns";
import {
  defaultValue,
  type IsNullable,
  nullable,
  primaryKey,
} from "./columns/properties";
import { pipe } from "./pipe";
import { Table, TableFields } from "./table_new";
import type { MakeTableObject, NullableFields } from "./table_new";

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

type BookInferrred = MakeTableObject<Book[typeof TableFields]>;
