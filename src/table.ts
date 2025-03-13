import { BaseColumn, string } from "./columns"
import { type Class, type Clean, member } from "./utils"

type Relation<
	VirtualField extends string,
	Ref extends () => any,
	Table extends InstanceType<ReturnType<Ref>>,
	FK extends keyof Table,
> = {
	ref: Ref
	virtualField: VirtualField
	foreignKey: FK
}

function relation<
	VirtualField extends string,
	Ref extends () => any,
	Table extends InstanceType<ReturnType<Ref>>,
	FK extends keyof Table,
>(
	virtualField: VirtualField,
	ref: Ref,
	foreignKey: FK,
): Relation<VirtualField, Ref, Table, FK> {
	return {
		virtualField,
		ref,
		foreignKey,
	}
}

function Table<
	const Fields extends Record<string, BaseColumn<any, any>>,
	const Relations extends Record<
		string,
		Relation<any, any, any, any>
	>,
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
	{ author: relation("authorId", () => User, "id") },
) {}

const author = relation("authorId", () => User, "id")

const asdf = () => User
type asdf = InstanceType<ReturnType<typeof asdf>>

const userName = member(Book, "author")
