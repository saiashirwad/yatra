import {
  date,
  number,
  string,
  uuid
} from "./columns/base-columns"
import {
  defaultValue,
  nullable,
  primaryKey
} from "./columns/properties"
import { pipe } from "./pipe"
import { oneToMany, oneToOne } from "./relation"
import { Table } from "./table"
import { query, select } from "./query-2"

class Tag extends Table("tag", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  createdAt: pipe(date, defaultValue(new Date())),
  updatedAt: pipe(date, defaultValue(new Date()))
}) {}

class Book extends Table("book", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  createdAt: pipe(date, defaultValue(new Date())),
  updatedAt: pipe(date, defaultValue(new Date())),
  authorId: string,
  description: pipe(string, defaultValue("what"), nullable),
  price: pipe(number, nullable)
}) {
  get author() {
    return oneToOne(
      () => Book,
      () => Author,
      "book.authorId",
      "author.id"
    )
  }

  get tags() {
    return oneToMany(
      () => Book,
      () => Tag,
      "book.id",
      "tag.id"
    )
  }
}

class Author extends Table("author", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  description: pipe(string, nullable),
  createdAt: pipe(date, defaultValue(new Date())),
  updatedAt: pipe(date, defaultValue(new Date()))
}) {
  get books() {
    return oneToMany(
      () => Author,
      () => Book,
      "author.id",
      "book.authorId"
    )
  }
}

const something = pipe(
  Author,
  query,
  select(
    "id",
    "description",
    "books.name",
    "books.tags.id as tagId"
  )
)
