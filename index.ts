interface HKT<URI, A> {}

interface SchemaURI {
	readonly _URI: unique symbol
}

interface StringFieldURI extends SchemaURI {
	readonly StringField: unique symbol
}
interface NumberFieldURI extends SchemaURI {
	readonly NumberField: unique symbol
}
interface JsonFieldURI extends SchemaURI {
	readonly JsonField: unique symbol
}
interface RelationFieldURI extends SchemaURI {
	readonly RelationField: unique symbol
}

type Kind<
	URI,
	A,
	Ctx extends Record<string, any> = {},
> = URI extends StringFieldURI
	? StringFieldF<Ctx>
	: URI extends NumberFieldURI
		? NumberFieldF<Ctx>
		: URI extends JsonFieldURI
			? JsonFieldF<Ctx>
			: URI extends RelationFieldURI
				? RelationFieldF<Ctx>
				: FieldF<URI & SchemaURI, A, Ctx>

interface FieldF<
	URI extends SchemaURI,
	A,
	Ctx extends Record<string, any> = {},
> {
	readonly _URI: URI["_URI"]
	readonly _A: A
	readonly _Ctx: Ctx

	primaryKey(): Kind<URI, A, Ctx & { __primaryKey: true }>
	notNull(): Kind<URI, A, Ctx & { __notNull: true }>
	unique(): Kind<URI, A, Ctx & { __unique: true }>
	default<V extends A>(value: V): Kind<URI, A, Ctx & { __default: V }>
}

interface StringFieldF<Ctx extends Record<string, any> = {}>
	extends FieldF<StringFieldURI, string, Ctx> {
	format<F extends string>(format: F): StringFieldF<Ctx & { __format: F }>
	minLength(length: number): StringFieldF<Ctx & { __minLength: number }>
	maxLength(length: number): StringFieldF<Ctx & { __maxLength: number }>
}

interface NumberFieldF<Ctx extends Record<string, any> = {}>
	extends FieldF<NumberFieldURI, number, Ctx> {
	min(value: number): NumberFieldF<Ctx & { __min: number }>
	max(value: number): NumberFieldF<Ctx & { __max: number }>
	integer(): NumberFieldF<Ctx & { __integer: true }>
	autoIncrement(): NumberFieldF<Ctx & { __autoIncrement: true }>
}

interface JsonFieldF<Ctx extends Record<string, any> = {}>
	extends FieldF<JsonFieldURI, object, Ctx> {
	_jsonSchema?: Record<string, any>
}

interface RelationFieldF<Ctx extends Record<string, any> = {}>
	extends FieldF<RelationFieldURI, any, Ctx> {
	onDelete(
		action: "cascade" | "restrict" | "set null" | "set default",
	): RelationFieldF<Ctx & { __onDelete: string }>
	onUpdate(
		action: "cascade" | "restrict" | "set null" | "set default",
	): RelationFieldF<Ctx & { __onUpdate: string }>
}

function createMethod<
	URI extends SchemaURI,
	A,
	Ctx extends Record<string, any>,
	PropName extends string,
	PropValue,
>(
	self: FieldF<URI, A, Ctx>,
	propName: PropName,
	propValue: PropValue,
): Kind<URI, A, Ctx & { [K in PropName]: PropValue }> {
	return Object.create(
		Object.getPrototypeOf(self),
		Object.getOwnPropertyDescriptors({
			...self,
			_Ctx: { ...self._Ctx, [propName]: propValue },
		}),
	) as Kind<URI, A, Ctx & { [K in PropName]: PropValue }>
}

function createBaseFieldMethods<URI extends SchemaURI, A>() {
	return {
		primaryKey<Ctx extends Record<string, any>>(this: FieldF<URI, A, Ctx>) {
			return createMethod(this, "__primaryKey", true)
		},
		notNull<Ctx extends Record<string, any>>(this: FieldF<URI, A, Ctx>) {
			return createMethod(this, "__notNull", true)
		},
		unique<Ctx extends Record<string, any>>(this: FieldF<URI, A, Ctx>) {
			return createMethod(this, "__unique", true)
		},
		default<Ctx extends Record<string, any>, V extends A>(
			this: FieldF<URI, A, Ctx>,
			value: V,
		) {
			return createMethod(this, "__default", value)
		},
	}
}

function stringField(): StringFieldF<{}> {
	const base = createBaseFieldMethods<StringFieldURI, string>()
	const methods = {
		...base,
		format<Ctx extends Record<string, any>, F extends string>(
			this: StringFieldF<Ctx>,
			f: F,
		) {
			return createMethod(this, "__format", f)
		},
		minLength<Ctx extends Record<string, any>>(
			this: StringFieldF<Ctx>,
			len: number,
		) {
			return createMethod(this, "__minLength", len)
		},
		maxLength<Ctx extends Record<string, any>>(
			this: StringFieldF<Ctx>,
			len: number,
		) {
			return createMethod(this, "__maxLength", len)
		},
	}

	return Object.create(methods, {
		_URI: { value: Symbol("StringField"), writable: false },
		_A: { value: undefined, writable: false },
		_Ctx: { value: {}, writable: true },
	}) as StringFieldF<{}>
}

function numberField(): NumberFieldF<{}> {
	const base = createBaseFieldMethods<NumberFieldURI, number>()
	const methods = {
		...base,
		min<Ctx extends Record<string, any>>(this: NumberFieldF<Ctx>, val: number) {
			return createMethod(this, "__min", val)
		},
		max<Ctx extends Record<string, any>>(this: NumberFieldF<Ctx>, val: number) {
			return createMethod(this, "__max", val)
		},
		integer<Ctx extends Record<string, any>>(this: NumberFieldF<Ctx>) {
			return createMethod(this, "__integer", true)
		},
		autoIncrement<Ctx extends Record<string, any>>(this: NumberFieldF<Ctx>) {
			return createMethod(this, "__autoIncrement", true)
		},
	}

	return Object.create(methods, {
		_URI: { value: Symbol("NumberField"), writable: false },
		_A: { value: undefined, writable: false },
		_Ctx: { value: {}, writable: true },
	}) as NumberFieldF<{}>
}

type JsonSchemaBuilder = {
	string(): StringFieldF<{}>
	number(): NumberFieldF<{}>
	json<S extends Record<string, any>>(
		schemaBuilder: (j: JsonSchemaBuilder) => S,
	): JsonFieldF<{}>
}

function createJsonSchemaBuilder(): JsonSchemaBuilder {
	return {
		string: stringField,
		number: numberField,
		json: jsonField,
	}
}

function jsonField<Schema extends Record<string, any>>(
	schemaBuilder?: (j: JsonSchemaBuilder) => Schema,
): JsonFieldF<{}> {
	const base = createBaseFieldMethods<JsonFieldURI, object>()
	const methods = { ...base }

	const field = Object.create(methods, {
		_URI: { value: Symbol("JsonField"), writable: false },
		_A: { value: undefined, writable: false },
		_Ctx: { value: {}, writable: true },
	}) as JsonFieldF<{}>

	if (schemaBuilder) {
		const b = createJsonSchemaBuilder()
		const schema = schemaBuilder(b)
		Object.defineProperty(field, "_jsonSchema", {
			value: schema,
			writable: false,
			enumerable: true,
		})
	}

	return field
}

function relationField<T extends string>(tableName: T, foreignKey?: string) {
	const base = createBaseFieldMethods<RelationFieldURI, any>()
	const methods = {
		...base,
		onDelete<Ctx extends Record<string, any>>(
			this: RelationFieldF<Ctx>,
			action: "cascade" | "restrict" | "set null" | "set default",
		) {
			return createMethod(this, "__onDelete", action)
		},
		onUpdate<Ctx extends Record<string, any>>(
			this: RelationFieldF<Ctx>,
			action: "cascade" | "restrict" | "set null" | "set default",
		) {
			return createMethod(this, "__onUpdate", action)
		},
	}

	return Object.create(methods, {
		_URI: { value: Symbol("RelationField"), writable: false },
		_A: { value: undefined, writable: false },
		_Ctx: {
			value: { __tableName: tableName, __foreignKey: foreignKey },
			writable: true,
		},
	}) as RelationFieldF<{ __tableName: T; __foreignKey?: string }>
}

type TableDefinition<T extends Record<string, FieldF<any, any, any>>> = {
	__fields: T
}

type AnyTableMap = Record<string, TableDefinition<any>>

type FinalSchema<Tables extends AnyTableMap> = {
	__tables: Tables
	table<K extends keyof Tables>(name: K): Tables[K]
} & {
	[K in keyof Tables & string]: (
		foreignKey?: string,
	) => RelationFieldF<{ __tableName: K; __foreignKey?: string }>
}

interface SchemaBuilderWithTables<Tables extends AnyTableMap> {
	string(): StringFieldF<{}>
	number(): NumberFieldF<{}>
	json<S extends Record<string, any>>(
		fn: (j: JsonSchemaBuilder) => S,
	): JsonFieldF<{}>

	table<
		Name extends string,
		Fields extends Record<string, FieldF<any, any, any>>,
	>(
		name: Name,
		fieldsOrBuilder: Fields | ((t: Record<string, string>) => Fields),
	): SchemaBuilderWithTables<Tables & { [K in Name]: TableDefinition<Fields> }>

	build(): FinalSchema<Tables>
}

function makeSchemaBuilder(): SchemaBuilderWithTables<{}> {
	return makeSchemaBuilderWithTables({})
}

function makeSchemaBuilderWithTables<Tables extends AnyTableMap>(
	tables: Tables,
): SchemaBuilderWithTables<Tables> {
	return {
		string: stringField,
		number: numberField,
		json: jsonField,

		table<
			Name extends string,
			Fields extends Record<string, FieldF<any, any, any>>,
		>(
			name: Name,
			fieldsOrBuilder: Fields | ((t: Record<string, string>) => Fields),
		) {
			let fields: Fields
			if (typeof fieldsOrBuilder === "function") {
				const tableHelper = new Proxy(
					{},
					{
						get(_target, propKey) {
							return typeof propKey === "string" ? propKey : undefined
						},
					},
				)
				fields = fieldsOrBuilder(tableHelper as Record<string, string>)
			} else {
				fields = fieldsOrBuilder
			}

			const next: Tables & { [K in Name]: TableDefinition<Fields> } = {
				...tables,
				[name]: { __fields: fields },
			}
			return makeSchemaBuilderWithTables(next)
		},

		build(): FinalSchema<Tables> {
			return new Proxy(
				// @ts-ignore
				{
					__tables: tables,
					table(name: keyof Tables) {
						return tables[name]
					},
				},
				{
					get(target, prop: string) {
						if (prop in tables) {
							return (foreignKey?: string) => relationField(prop, foreignKey)
						}
						if (prop in target) {
							return (target as any)[prop]
						}
						return undefined
					},
				},
			) as FinalSchema<Tables>
		},
	}
}

const db = makeSchemaBuilder()
	.table("user", {
		id: stringField().primaryKey().format("uuid"),
		name: stringField(),
		email: stringField().unique(),
		createdAt: stringField().default("now()"),
	})
	.table("book", (t) => ({
		id: stringField().primaryKey().format("uuid"),
		title: stringField().notNull(),
		authorId: stringField(),
		author: relationField("user", t.authorId).onDelete("cascade"),
		metadata: jsonField((j) => ({
			publishedYear: j.number(),
			publisher: j.string(),
			tags: j.json((j2) => ({
				name: j2.string(),
			})),
		})),
	}))
	.build()

const userTable = db.table("user")
const bookTable = db.table("book")

const someRelation = db.book("foreignKeyHere")
console.log(db)

type ExtractContext<T> = T extends FieldF<any, any, infer Ctx> ? Ctx : never

type UserIdType = ExtractContext<typeof userTable.__fields.id>

type BookAuthorType = ExtractContext<typeof bookTable.__fields.author>
