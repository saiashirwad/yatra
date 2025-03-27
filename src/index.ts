import type { ExtractFields } from "./base-relation";
import { date, number, string, uuid } from "./columns/base-columns";
import { defaultValue, nullable, primaryKey } from "./columns/properties";
import { pipe } from "./pipe";
import { manyToMany, manyToOne, oneToMany, oneToOne } from "./table";
import { Table } from "./table";
import type { MakeTableObject } from "./types";

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
    description: pipe(string(), defaultValue("what"), nullable),
    price: pipe(number(), nullable),
  },
) {}

class Author extends Table(
  "author",
  {
    ...basicColumns,
    // books: oneToMany(() => Author, () => Book, 'authorId'),
  },
) {}

type BookFields = MakeTableObject<ExtractFields<typeof Book>>;

class Profile extends Table(
  "author_profile",
  {
    ...basicColumns,
  },
) {}
