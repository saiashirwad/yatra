import { date, number, string, uuid } from "./columns/base-columns";
import { defaultValue, nullable, primaryKey } from "./columns/properties";
import { pipe } from "./pipe";
import { getRelation, oneToMany, oneToOne } from "./relation";
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
    return oneToMany(() => Author, () => Book, "author.id", "book.id");
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
    return oneToOne(() => Book, () => Author, "book.authorId", "author.id");
  }

  get tags() {
    return oneToMany(() => Book, () => Tag, "book.id", "tag.id");
  }
}

console.log(Book.map(x => x.authorId));

console.log(getRelation(Book, "author"));
