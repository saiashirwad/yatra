import { date, number, string, uuid } from "./columns/base-columns";
import { defaultValue, nullable, primaryKey } from "./columns/properties";
import { pipe } from "./pipe";
import { oneToMany, oneToOne, Relation } from "./relation";
import { Table } from "./table";
import type { TableLike } from "./utils";

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

function getRelation<
  T extends TableLike,
  const Relations extends keyof {
    [k in keyof T["prototype"]]: T[k];
  },
>(c: T, name: Relations): T["prototype"][Relations] {
  return c.prototype[name];
}

type TableRelations<
  T extends TableLike,
> =
  & {
    -readonly [
      key in keyof T["prototype"] as T["prototype"][key] extends
        Relation<any, any> ? key : never
    ]: T["prototype"][key];
  }
  & {};

function getRelationNames<T extends TableLike>(table: T): TableRelations<T> {
  return Reflect.ownKeys(table.prototype).filter((key) => {
    return table.prototype[key] instanceof Relation;
  }) as any;
}

const relations = getRelationNames(Book);
type relations = typeof relations;
console.log(relations);
