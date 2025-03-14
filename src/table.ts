import { _enum, array, Column, string, uuid } from "./columns"
import { type Constructor } from "./utils"

export function member<
	Co extends Constructor,
	Instance extends InstanceType<Co>,
	K extends keyof Instance,
>(c: Co, key: K): Instance[K] {
	return new c()[key]
}

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
	Ref extends () => { fields: any },
> {
	private virtualField?: keyof F
	private foreignKey?: keyof ReturnType<Ref>["fields"]

	constructor(
		private fields: F,
		private ref: Ref,
	) {}

	using<VF extends keyof F>(virtualField: VF) {
		this.virtualField = virtualField
		return this
	}

	references<FK extends keyof ReturnType<Ref>["fields"]>(foreignKey: FK) {
		this.foreignKey = foreignKey
		return this
	}

	build(): ManyToOneRelation<Ref, keyof F, keyof ReturnType<Ref>["fields"]> {
		if (!this.virtualField || !this.foreignKey) {
			throw new Error("ManyToOne relation requires both virtualField and foreignKey")
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
	Ref extends () => { fields: any },
> {
	private virtualField?: keyof F
	private foreignKey?: keyof ReturnType<Ref>["fields"]

	constructor(
		private fields: F,
		private ref: Ref,
	) {}

	using<VF extends keyof F>(virtualField: VF) {
		this.virtualField = virtualField
		return this
	}

	references<FK extends keyof ReturnType<Ref>["fields"]>(foreignKey: FK) {
		this.foreignKey = foreignKey
		return this
	}

	build(): OneToOneRelation<Ref, keyof F, keyof ReturnType<Ref>["fields"]> {
		if (!this.virtualField || !this.foreignKey) {
			throw new Error("OneToOne relation requires both virtualField and foreignKey")
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
	Ref extends () => { fields: any },
>(t: F, ref: Ref): ManyToOneBuilder<F, Ref> {
	return new ManyToOneBuilder(t, ref)
}

export function oneToMany<F extends Record<string, Column<any, any>>, Ref extends () => any>(
	t: F,
	ref: Ref,
): OneToManyBuilder<Ref> {
	return new OneToManyBuilder(ref)
}

export function oneToOne<
	F extends Record<string, Column<any, any>>,
	Ref extends () => { fields: any },
>(t: F, ref: Ref): OneToOneBuilder<F, Ref> {
	return new OneToOneBuilder(t, ref)
}

type RelationsFunction<
	Fields extends Record<string, Column<any, any>>,
	Relations extends Record<string, Relation>,
> = (fields: Fields) => Relations

type TableConstructor<F, R> = {
	new (): { fields: F; relations: R }
	fields: F
	relations: R
}

function Table<
	const TableName extends string,
	const Fields extends Record<string, Column<any, any>>,
	const Relations extends Record<string, Relation> = Record<string, never>,
>(tableName: TableName, _fields: Fields, relationsFn?: RelationsFunction<Fields, Relations>) {
	class TableClass {
		public relations: Relations
		constructor(
			public name: TableName = tableName,
			public fields: Fields = _fields,
		) {
			this.relations = relationsFn ? relationsFn(_fields) : ({} as Relations)
		}
	}
	return TableClass as unknown as TableConstructor<Fields, Relations>
}

class Book extends Table(
	"book",
	{
		id: uuid().primaryKey(),
		authorId: string(),
		description: string().default("what"),
	},
	(fields) => ({
		author: manyToOne(fields, () => new User())
			.using("authorId")
			.references("id")
			.build(),
	}),
) {}

class User extends Table(
	"user",
	{
		id: uuid().primaryKey(),
		name: string().default("no name").unique(),
		tags: array(_enum(["hi", "there"])).nullable(),
	},
	(fields) => ({
		books: oneToMany(fields, () => new Book()).build(),
	}),
) {}

const user = new User()

const rels = user.relations
