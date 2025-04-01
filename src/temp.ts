// const result = pipe(
//   Author,
//   query,
//   select("id", "name", "books"),
//   select("description"),
//   orderBy("id", "desc"),
//   where("author.id", "=", "asdf"),
// );
//
// const asdf = pipe(
//   Book,
//   query,
//   select("id", "name", "author", "updatedAt", "tags"),
// );
//
// const lol = qualifiedField(Book, "book.authorId");
//
// type bookrelations = TableRelations<typeof Book>;
// type asdfasdf = GetRelation<typeof Book, "author">;
//
// type wer = GetPath<typeof Book, "author.description">;
