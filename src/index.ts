import { date, number, string, uuid } from "./columns/base-columns";
import { defaultValue, nullable, primaryKey } from "./columns/properties";
import { pipe } from "./pipe";
import { Table, TableFields } from "./table";

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
    return this.oneToMany(() => Book, "id", "id");
  }
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
    return this.oneToOne(() => Author, "authorId", "id");
  }
}
