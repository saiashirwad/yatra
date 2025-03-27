import { date, number, string, uuid } from "./columns/base-columns";
import { defaultValue, nullable, primaryKey } from "./columns/properties";
import { pipe } from "./pipe";
import { oneToMany, oneToOne } from "./table";
import { Table } from "./table";

const basicColumns = {
  id: pipe(uuid(), primaryKey),
  name: pipe(string()),
  createdAt: pipe(date(), defaultValue(new Date())),
  updatedAt: pipe(date(), defaultValue(new Date())),
};

class Tag extends Table("Tag", {
  ...basicColumns,
}) {}

class Book extends Table(
  "book",
  {
    ...basicColumns,
    authorId: string(),
    description: pipe(string(), defaultValue("what"), nullable),
    price: pipe(number(), nullable),
  },
) {
  get author() {
    return oneToOne(() => Book, () => Author, "authorId");
  }

  get tags() {
    return oneToMany(() => Book, () => Tag, "id");
  }
}

class Author extends Table(
  "author",
  {
    ...basicColumns,
    // books: oneToMany(() => Author, () => Book, 'authorId'),
  },
) {}

const book = new Book({
  authorId: "asdf",
  createdAt: new Date(),
  id: "adsf",
  name: "asdf",
  updatedAt: new Date(),
});
const bookPrototype = Object.getPrototypeOf(book);

console.log(Object.getOwnPropertyDescriptors(bookPrototype));

// type BookFields = MakeTableObject<ExtractFields<typeof Book>>;
//
// class Profile extends Table(
//   "author_profile",
//   {
//     ...basicColumns,
//   },
// ) {}
