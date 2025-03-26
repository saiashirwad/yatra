import { date, number, string, uuid } from "./columns/base-columns";
import { defaultValue, nullable, primaryKey } from "./columns/properties";
import { pipe } from "./pipe";
import {
  type ExtractFields,
  manyToMany,
  manyToOne,
  oneToMany,
  oneToOne,
} from "./relations";
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
    description: pipe(string(), defaultValue("what"), nullable),
    price: pipe(number(), nullable),
  },
) {}

class Author extends Table(
  "author",
  {
    ...basicColumns,
  },
) {}

type BookFields = ExtractFields<typeof Book>;

class AuthorProfile extends Table(
  "author_profile",
  {
    ...basicColumns,
  },
) {}

const authorToProfile = oneToOne(
  () => Author,
  () => AuthorProfile,
  "id",
);

const authorToBooks = oneToMany(
  () => Author,
  () => Book,
  "authorId",
);

const bookToAuthor = manyToOne(
  () => Book,
  () => Author,
  "authorId",
);

const bookToAuthors = manyToMany(
  () => Book,
  () => Author,
  "book_to_author",
  "id",
  "id",
);
