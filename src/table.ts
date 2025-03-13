import { BaseColumn, string } from "./columns"
import { type Constructor } from "./utils"

export function member<
	Co extends Constructor,
	Instance extends InstanceType<Co>,
	K extends keyof Instance,
>(c: Co, key: K): Instance[K] {
	return new c()[key]
}

type ManyToOne<VirtualField, Ref, foreignKey> = {
	kind: "many-to-one"
	virtualField: VirtualField
	ref: Ref
	foreignKey: foreignKey
}

function ManyToOne<
	Ref extends () => { fields: any },
	VirtualField extends string,
	FK extends keyof ReturnType<Ref>["fields"],
>(ref: Ref, virtualField: VirtualField, foreignKey: FK): ManyToOne<VirtualField, Ref, FK> {
	return {
		kind: "many-to-one",
		virtualField,
		ref,
		foreignKey,
	}
}

type OneToMany<Ref> = {
	kind: "one-to-many"
	ref: Ref
}

function OneToMany<Ref extends () => any>(ref: Ref): OneToMany<Ref> {
	return {
		kind: "one-to-many",
		ref,
	}
}

type Relation = ManyToOne<any, any, any> | OneToMany<any>

type TableConstructor<F, R> = {
	new (): { fields: F; relations: R }
	fields: F
	relations: R
}

function Table<
	const TableName extends string,
	const Fields extends Record<string, BaseColumn<any, any, any>>,
	const Relations extends Record<string, Relation>,
>(tableName: TableName, _fields: Fields, _relations: Relations = {} as Relations) {
	class TableClass {
		constructor(
			public name: TableName = tableName,
			public fields: Fields = _fields,
			public relations: Relations = _relations,
		) {}
	}

	return TableClass as unknown as TableConstructor<Fields, Relations>
}

class User extends Table(
	"user",
	{
		id: string(),
		name: string().maxLength(5).nullable().default("texo"),
	},
	{
		books: OneToMany(() => Book),
	},
) {}

class Book extends Table(
	"book",
	{
		id: string(),
		authorId: string(),
	},
	{
		author: ManyToOne(() => User, "authorId", "id"),
	},
) {}

const userId = member(User, "fields")

console.log(userId)
