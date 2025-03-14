import { Column, string } from "./columns"
import { type Constructor } from "./utils"

export function member<
	Co extends Constructor,
	Instance extends InstanceType<Co>,
	K extends keyof Instance,
>(c: Co, key: K): Instance[K] {
	return new c()[key]
}

type ManyToOne<VirtualField, Ref, ForeignKey> = {
	kind: "many-to-one"
	virtualField: VirtualField
	ref: Ref
	foreignKey: ForeignKey
}

type OneToMany<Ref> = {
	kind: "one-to-many"
	ref: Ref
}

type OneToOne<VirtualField, Ref, ForeignKey> = {
	kind: "one-to-one"
	virtualField: VirtualField
	ref: Ref
	foreignKey: ForeignKey
}

export type Relation = ManyToOne<any, any, any> | OneToMany<any> | OneToOne<any, any, any>

interface RelationBuilder<F extends Record<string, Column<any, any>>> {
	manyToOne: <
		Ref extends () => { fields: any },
		VF extends keyof F,
		FK extends keyof ReturnType<Ref>["fields"],
	>(
		virtualField: VF,
		ref: Ref,
		foreignKey: FK,
	) => ManyToOne<VF, Ref, FK>

	oneToMany: <Ref extends () => any>(ref: Ref) => OneToMany<Ref>

	oneToOne: <
		Ref extends () => { fields: any },
		VF extends keyof F,
		FK extends keyof ReturnType<Ref>["fields"],
	>(
		virtualField: VF,
		ref: Ref,
		foreignKey: FK,
	) => OneToOne<VF, Ref, FK>

	fields: F
}

type TableConstructor<F, R> = {
	new (): { fields: F; relations: R }
	fields: F
	relations: R
}

function createRelationBuilder<F extends Record<string, Column<any, any>>>(
	fields: F,
): RelationBuilder<F> {
	return {
		manyToOne: (virtualField, ref, foreignKey) => ({
			kind: "many-to-one" as const,
			virtualField,
			ref,
			foreignKey,
		}),

		oneToMany: (ref) => ({
			kind: "one-to-many" as const,
			ref,
		}),

		oneToOne: (virtualField, ref, foreignKey) => ({
			kind: "one-to-one" as const,
			virtualField,
			ref,
			foreignKey,
		}),

		fields,
	}
}

function Table<
	const TableName extends string,
	const Fields extends Record<string, Column<any, any>>,
	const Relations extends Record<string, Relation> = Record<string, never>,
>(
	tableName: TableName,
	_fields: Fields,
	relationsFn?: (rel: RelationBuilder<Fields>) => Relations,
) {
	class TableClass {
		public relations: Relations
		constructor(
			public name: TableName = tableName,
			public fields: Fields = _fields,
		) {
			this.relations = relationsFn ? relationsFn(createRelationBuilder(_fields)) : ({} as Relations)
		}
	}

	return TableClass as unknown as TableConstructor<Fields, Relations>
}

class Book extends Table(
	"book",
	{
		id: string(),
		authorId: string(),
		description: string().default("what"),
	},
	(t) => ({
		author: t.manyToOne("authorId", () => User, "id"),
	}),
) {}

class User extends Table(
	"user",
	{
		id: string(),
		name: string().maxLength(5).nullable().default("texo"),
		siblingId: string().nullable(),
	},
	(t) => ({
		books: t.oneToMany(() => Book),
	}),
) {}

console.log(new User())
