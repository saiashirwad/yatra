import {
  date,
  number,
  string,
  uuid,
} from "./columns/base-columns";
import {
  defaultValue,
  nullable,
  primaryKey,
} from "./columns/properties";
import { pipe } from "./pipe";
import {
  getRelationNames,
  oneToMany,
  oneToOne,
} from "./relation";
import { Table } from "./table";

class Author extends Table(
  "author",
  {
    id: pipe(uuid(), primaryKey),
    name: pipe(string()),
    createdAt: pipe(date(), defaultValue(new Date())),
    updatedAt: pipe(date(), defaultValue(new Date())),
  },
) {
  get books() {
    return oneToMany(
      () => Author,
      () => Book,
      "author.id",
      "book.id",
    );
  }
}

class Tag extends Table(
  "tag",
  {
    id: pipe(uuid(), primaryKey),
    name: pipe(string()),
    createdAt: pipe(date(), defaultValue(new Date())),
    updatedAt: pipe(date(), defaultValue(new Date())),
  },
) {
}

class Book extends Table(
  "book",
  {
    id: pipe(uuid(), primaryKey),
    name: pipe(string()),
    createdAt: pipe(date(), defaultValue(new Date())),
    updatedAt: pipe(date(), defaultValue(new Date())),
    authorId: string(),
    description: pipe(
      string(),
      defaultValue("what"),
      nullable,
    ),
    price: pipe(number(), nullable),
  },
) {
  get author() {
    return oneToOne(
      () => Book,
      () => Author,
      "book.authorId",
      "author.id",
    );
  }

  get tags() {
    return oneToMany(
      () => Book,
      () => Tag,
      "book.id",
      "tag.id",
    );
  }
}

const book = new Book({
  authorId: "auth123",
  createdAt: new Date(),
  id: "book456",
  name: "TypeScript ORM Design Patterns",
  updatedAt: new Date(),
});

const relations = getRelationNames(Book);
console.log(relations);

const rel = oneToOne(
  () => Book,
  () => Author,
  "book.authorId",
  "author.id",
);
