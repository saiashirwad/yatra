import { Effect } from "effect"
import {
  manyToMany,
  manyToOne,
  nullable,
  number,
  oneToMany,
  pipe,
  primaryKey,
  string,
  Table,
  uuid
} from "yatra"
import { YatraExecutor } from "../src/index.ts"

export class Author extends Table("author", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  bio: pipe(string, nullable)
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

export class Book extends Table("book", {
  id: pipe(uuid, primaryKey),
  name: pipe(string),
  price: pipe(number, nullable),
  authorId: pipe(uuid)
}) {
  get author() {
    return manyToOne(
      () => Book,
      () => Author,
      "book.authorId",
      "author.id"
    )
  }
  get tags() {
    return manyToMany(
      () => Book,
      () => Tag,
      "book_tag",
      "book.id",
      "tag.id"
    )
  }
}

export class Tag extends Table("tag", {
  id: pipe(uuid, primaryKey),
  label: pipe(string)
}) {}

export const ids = {
  leGuin: "11111111-1111-4111-8111-111111111111",
  butler: "22222222-2222-4222-8222-222222222222",
  lem: "33333333-3333-4333-8333-333333333333",
  dispossessed: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  earthsea: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  kindred: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  parable: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  solaris: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  fiasco: "abababab-abab-4bab-8bab-abababababab",
  scienceFiction: "f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1",
  fantasy: "f2f2f2f2-f2f2-42f2-82f2-f2f2f2f2f2f2",
  philosophy: "f3f3f3f3-f3f3-43f3-83f3-f3f3f3f3f3f3"
}

const statements = [
  `create table author (
    id uuid primary key,
    name text not null,
    bio text
  )`,
  `create table book (
    id uuid primary key,
    name text not null,
    price double precision,
    "authorId" uuid not null references author(id)
  )`,
  `create table tag (
    id uuid primary key,
    label text not null
  )`,
  `create table book_tag (
    book_id uuid not null references book(id),
    tag_id uuid not null references tag(id),
    primary key (book_id, tag_id)
  )`,
  `insert into author (id, name, bio) values
    ('${ids.leGuin}', 'Ursula K. Le Guin', 'American author of the Earthsea cycle'),
    ('${ids.butler}', 'Octavia E. Butler', null),
    ('${ids.lem}', 'Stanisław Lem', 'Polish writer of philosophical science fiction')`,
  `insert into book (id, name, price, "authorId") values
    ('${ids.dispossessed}', 'The Dispossessed', 12.5, '${ids.leGuin}'),
    ('${ids.earthsea}', 'A Wizard of Earthsea', 9.99, '${ids.leGuin}'),
    ('${ids.kindred}', 'Kindred', 14, '${ids.butler}'),
    ('${ids.parable}', 'Parable of the Sower', null, '${ids.butler}'),
    ('${ids.solaris}', 'Solaris', 11, '${ids.lem}')`,
  `insert into tag (id, label) values
    ('${ids.scienceFiction}', 'science fiction'),
    ('${ids.fantasy}', 'fantasy'),
    ('${ids.philosophy}', 'philosophy')`,
  `insert into book_tag (book_id, tag_id) values
    ('${ids.dispossessed}', '${ids.scienceFiction}'),
    ('${ids.dispossessed}', '${ids.philosophy}'),
    ('${ids.earthsea}', '${ids.fantasy}'),
    ('${ids.kindred}', '${ids.scienceFiction}'),
    ('${ids.solaris}', '${ids.scienceFiction}'),
    ('${ids.solaris}', '${ids.philosophy}')`
]

export const setup = Effect.gen(function* () {
  const exec = yield* YatraExecutor
  yield* Effect.forEach(
    statements,
    s => exec.query(s, []),
    {
      discard: true
    }
  )
})
