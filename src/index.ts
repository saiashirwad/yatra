import { date, number, string, uuid } from "./columns/base-columns";
import { defaultValue, nullable, primaryKey } from "./columns/properties";
import { pipe } from "./pipe";
import { oneToMany, oneToOne } from "./relation";
import { info, table } from "./table";

class Author extends table(
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

class Tag extends table(
  "tag",
  {
    id: pipe(uuid(), primaryKey),
    name: pipe(string()),
    createdAt: pipe(date(), defaultValue(new Date())),
    updatedAt: pipe(date(), defaultValue(new Date())),
  },
) {
}

class Book extends table(
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

const result = pipe(Author, info);
console.log(result["relations"]["books"]);
