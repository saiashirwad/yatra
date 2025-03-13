import { BaseColumn, string } from "./columns"
import {
	type Class,
	type Clean,
	type Constructor,
	member,
} from "./utils"

type TableFields = Record<string, BaseColumn<any, any>>

type Relationfields = Record<string, Relation<any, any, any, any>>

type ValidKeys<D> = keyof {
	[K in keyof D as D[K] extends string ? K : never]: D[K]
}

type Relation<
	VirtualField extends string,
	Co extends Constructor,
	Instance extends InstanceType<Co> = InstanceType<Co>,
	FK extends ValidKeys<Instance> = ValidKeys<Instance>,
> = {
	ref: () => Co
	virtualField: VirtualField
	foreignKey: FK
}

function relation<
	VirtualField extends string,
	Co extends Constructor,
	Instance extends InstanceType<Co>,
	FK extends ValidKeys<Instance>,
>(
	virtualField: VirtualField,
	ref: () => Co,
	foreignKey: FK,
): Relation<VirtualField, Co, Instance, FK> {
	return {
		virtualField,
		ref,
		foreignKey,
	}
}

function Table<
	const Fields extends TableFields,
	const Relations extends Relationfields,
>(fields: Fields, relations: Relations = {} as Relations) {
	return class {
		constructor() {
			Object.assign(this, { ...fields, ...relations })
		}
	} as Class<Clean<Fields & Relations>>
}

class User extends Table({
	id: string(),
	name: string().maxLength(5).nullable(),
}) {}

class Book extends Table(
	{
		id: string(),
		authorId: string(),
	},
	{ author: relation("author", () => User, "id") },
) {}

const userName = member(Book, "author")
