import {
	_enum,
	array,
	Column,
	number,
	string,
	uuid,
	type GetColumnType,
	type IsNullable,
} from "./columns"
import { type Clean, type Constructor } from "./utils"

export function member<
	Co extends Constructor,
	Instance extends InstanceType<Co>,
	K extends keyof Instance,
>(c: Co, key: K): Instance[K] {
	return new c()[key]
}

type TableConstructor<F> = new (...args: any[]) => { fields: F }

type ManyToOneRelation<Ref, VirtualField, ForeignKey> = {
	kind: "many-to-one"
	ref: Ref
	virtualField: VirtualField
	foreignKey: ForeignKey
}

type OneToManyRelation<Ref> = {
	kind: "one-to-many"
	ref: Ref
}

type OneToOneRelation<Ref, VirtualField, ForeignKey> = {
	kind: "one-to-one"
	ref: Ref
	virtualField: VirtualField
	foreignKey: ForeignKey
}

export type Relation =
	| ManyToOneRelation<any, any, any>
	| OneToManyRelation<any>
	| OneToOneRelation<any, any, any>

class ManyToOneBuilder<
	F extends Record<string, Column<any, any>>,
	Ref extends () => TableConstructor<any>,
> {
	private virtualField?: keyof F
	private foreignKey?: keyof InstanceType<ReturnType<Ref>>["fields"]

	constructor(
		private fields: F,
		private ref: Ref,
	) {}

	using<VF extends keyof F>(virtualField: VF) {
		this.virtualField = virtualField
		return this
	}

	references<
		FK extends keyof InstanceType<ReturnType<Ref>>["fields"],
	>(foreignKey: FK) {
		this.foreignKey = foreignKey
		return this
	}

	build(): ManyToOneRelation<
		Ref,
		keyof F,
		keyof InstanceType<ReturnType<Ref>>["fields"]
	> {
		if (!this.virtualField || !this.foreignKey) {
			throw new Error(
				"ManyToOne relation requires both virtualField and foreignKey",
			)
		}

		return {
			kind: "many-to-one",
			ref: this.ref,
			virtualField: this.virtualField,
			foreignKey: this.foreignKey,
		}
	}
}

class OneToManyBuilder<Ref extends () => any> {
	constructor(private ref: Ref) {}

	build(): OneToManyRelation<Ref> {
		return {
			kind: "one-to-many",
			ref: this.ref,
		}
	}
}

class OneToOneBuilder<
	F extends Record<string, Column<any, any>>,
	Ref extends () => TableConstructor<any>,
> {
	private virtualField?: keyof F
	private foreignKey?: keyof InstanceType<ReturnType<Ref>>["fields"]

	constructor(
		private fields: F,
		private ref: Ref,
	) {}

	using<VF extends keyof F>(virtualField: VF) {
		this.virtualField = virtualField
		return this
	}

	references<
		FK extends keyof InstanceType<ReturnType<Ref>>["fields"],
	>(foreignKey: FK) {
		this.foreignKey = foreignKey
		return this
	}

	build(): OneToOneRelation<
		Ref,
		keyof F,
		keyof InstanceType<ReturnType<Ref>>["fields"]
	> {
		if (!this.virtualField || !this.foreignKey) {
			throw new Error(
				"OneToOne relation requires both virtualField and foreignKey",
			)
		}

		return {
			kind: "one-to-one",
			ref: this.ref,
			virtualField: this.virtualField,
			foreignKey: this.foreignKey,
		}
	}
}

export function manyToOne<
	F extends Record<string, Column<any, any>>,
	Ref extends () => TableConstructor<any>,
>(t: F, ref: Ref): ManyToOneBuilder<F, Ref> {
	return new ManyToOneBuilder(t, ref)
}

export function oneToMany<
	F extends Record<string, Column<any, any>>,
	Ref extends () => any,
>(t: F, ref: Ref): OneToManyBuilder<Ref> {
	return new OneToManyBuilder(ref)
}

export function oneToOne<
	F extends Record<string, Column<any, any>>,
	Ref extends () => TableConstructor<any>,
>(t: F, ref: Ref): OneToOneBuilder<F, Ref> {
	return new OneToOneBuilder(t, ref)
}

type TableCallback<
	Fields extends Record<string, Column<any, any>>,
	Relations extends Record<string, Relation>,
> = (fields: Fields) => {
	relations: Relations
}

type MakeObject<
	Fields = Record<string, Column<any, any>>,
	Relations extends Record<string, Relation> = Record<string, never>,
	Nullable = {
		-readonly [k in keyof Fields as IsNullable<Fields[k]> extends true
			? k
			: never]?: GetColumnType<Fields[k]>
	},
	NonNullable = {
		-readonly [k in keyof Fields as IsNullable<
			Fields[k]
		> extends false
			? k
			: never]: GetColumnType<Fields[k]>
	},
	Rels = {
		[k in keyof Relations]?: Relations[k]["kind"] extends "one-to-one"
			?
					| InstanceType<ReturnType<Relations[k]["ref"]>>
					| MakeObject<
							InstanceType<ReturnType<Relations[k]["ref"]>>["fields"]
					  >
			: Relations[k]["kind"] extends "many-to-one" | "one-to-many"
				? Array<
						| InstanceType<ReturnType<Relations[k]["ref"]>>
						| Record<string, any>
					>
				: never
	},
> = Clean<Nullable & NonNullable & Rels>

type TableConstructorArgs<
	Fields extends Record<string, Column<any, any>>,
	Relations extends Record<string, Relation>,
> = MakeObject<Fields, Relations>

type Table = InstanceType<ReturnType<typeof Table>>

export function Table<
	const TableName extends string,
	const Fields extends Record<string, Column<any, any>>,
	const Relations extends Record<string, Relation> = Record<
		string,
		never
	>,
>(
	tableName: TableName,
	fields: Fields,
	callback?: TableCallback<Fields, Relations>,
) {
	type TableInstance = {
		name: TableName
		fields: Fields
		relations: Relations
	} & MakeObject<Fields>

	class TableClass {
		public name: TableName = tableName
		public fields: Fields = fields
		public relations: Relations = {} as Relations

		constructor(args: MakeObject<Fields, Relations>) {
			if (callback) {
				const result = callback(fields)
				this.relations = result.relations
			}
			if (typeof args === "object") {
				for (const key in args) {
					;(this as any)[key] = (args as any)[key]
				}
			}
		}
	}
	return TableClass as unknown as {
		new (args: TableConstructorArgs<Fields, Relations>): TableInstance
		readonly isTable: true
	}
}

class Book extends Table(
	"book",
	{
		id: uuid().primaryKey(),
		authorId: string(),
		description: string().default("what"),
		price: number().nullable(),
	},
	(fields) => ({
		relations: {
			author: oneToOne(fields, () => User)
				.using("authorId")
				.references("id")
				.build(),
		},
	}),
) {}

class User extends Table(
	"user",
	{
		id: uuid().primaryKey(),
		name: string().default("no name").unique(),
		tags: array(_enum(["hi", "there"])).nullable(),
		type: _enum(["admin", "user"]),
	},
	(fields) => ({
		relations: {
			books: oneToMany(fields, () => Book).build(),
		},
	}),
) {}

const book = new Book({
	id: "wa",
	price: 23,
	description: "asdf",
	authorId: "asdf",
})

const user = new User({
	type: "user",
	id: "asdf",
	name: "asdf",
	tags: [],
	books: [
		book,
		{ authorId: "asdf", description: "wtf", id: "asdf", price: 2 },
	],
})

console.log(user)

//const author = book.relations.author
//// @ts-ignore
//const lol = Reflect.construct(author.ref(), ["init"])
//// @ts-ignore
//console.log(lol)
