import { date, number, string, uuid } from "./columns/base-columns";
import { defaultValue, nullable, primaryKey } from "./columns/properties";
import { pipe } from "./pipe";
import { getRelationNames, oneToMany, oneToOne, Relation } from "./relation";
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
    return oneToMany(() => Author, () => Book, "id", "authorId");
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
    description: pipe(string(), defaultValue("what"), nullable),
    price: pipe(number(), nullable),
  },
) {
  get author() {
    return oneToOne(() => Book, () => Author, "authorId", "id");
  }

  get tags() {
    return oneToMany(() => Book, () => Tag, "id", "id");
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

type OptionsBag = {
  name: string;
  age: number;
};

function something<const T extends OptionsBag>(options: T) {
  return options;
}

const result = something({
  age: 2,
  name: "hi",
});
