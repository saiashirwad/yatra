# yatra

A playground for exploring ideas for a new, type-safe ORM for typescript.
Currently designed only with Postgres in mind

## Query builder ideas

pipe(Author, select('id', 'name', 'createdAt', 'books'))

pipe(Author, select('id', 'name', 'createdAt', 'books.id as bookId'))

const selectIdAndCreatedAt = <T extends { id: string, createdAt: Date }>() =>
select<T>(ctx => ({ id: ctx.id, createdAt: ctx.createdAt }))

const createdYesterday = <T extends { createdAt: Date }>() =>
where<T>(ctx => ctx('createdAt', '<', add(new Date(), { days: -1})))

pipe(
Author,
selectIdAndCreatedAt,
createdYesterday,
orderBy(ctx => ctx.createdAt)
)
