/***** 1) Basic HKT/URI/Field Definitions (same as your original) *****/
interface HKT<URI, A> {}

interface SchemaURI {
	readonly _URI: unique symbol
}

// Field type URIs
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

// Kind type definition
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

// Base field interface
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

/***** 2) Concrete Field Interfaces *****/
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

/***** 3) Helpers to add constraints to fields *****/
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

/***** 4) Concrete Field Constructors *****/
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

/***** 5) Table Definition *****/
type TableDefinition<T extends Record<string, FieldF<any, any, any>>> = {
	__fields: T
}

/***** 6) A “Chained” Schema Builder That Accumulates Tables *****/
type AnyTableMap = Record<string, TableDefinition<any>>

/**
 * The final schema we get after calling .build():
 * - `__tables`: the map of table definitions
 * - `table("someTableName")` for direct access
 * - and dynamic properties named after each table
 *   (which produce a typed RelationField).
 */
type FinalSchema<Tables extends AnyTableMap> = {
	__tables: Tables
	table<K extends keyof Tables>(name: K): Tables[K]
} & {
	[K in keyof Tables & string]: (
		foreignKey?: string,
	) => RelationFieldF<{ __tableName: K; __foreignKey?: string }>
}

/**
 * The intermediate builder that allows:
 *   - .string(), .number(), .json() for making columns
 *   - .table("tableName", { ...columns... }) to add a table
 *   - .build() to finalize the schema
 */
interface SchemaBuilderWithTables<Tables extends AnyTableMap> {
	// Field constructors so we can do builder.string(), etc.
	string(): StringFieldF<{}>
	number(): NumberFieldF<{}>
	json<S extends Record<string, any>>(
		fn: (j: JsonSchemaBuilder) => S,
	): JsonFieldF<{}>

	/**
	 * Add a table:
	 *   .table("user", { name: stringField(), ...})
	 * or
	 *   .table("book", (t) => ({ id: stringField(), authorId: stringField(), ... }))
	 * (the "t" would be a simple placeholder if you want to retrieve fields for that table)
	 */
	table<
		Name extends string,
		Fields extends Record<string, FieldF<any, any, any>>,
	>(
		name: Name,
		fieldsOrBuilder: Fields | ((t: Record<string, string>) => Fields),
	): SchemaBuilderWithTables<Tables & { [K in Name]: TableDefinition<Fields> }>

	build(): FinalSchema<Tables>
}

/**
 * Create an empty builder (no tables yet).
 */
function makeSchemaBuilder(): SchemaBuilderWithTables<{}> {
	return makeSchemaBuilderWithTables({})
}

/**
 * The engine that accumulates table definitions in `tables`,
 * returning a new builder type each time we add a table.
 */
function makeSchemaBuilderWithTables<Tables extends AnyTableMap>(
	tables: Tables,
): SchemaBuilderWithTables<Tables> {
	return {
		// Provide field constructors
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
			// If the user passes a function (like (t) => ...),
			// we supply a simple object proxy where each property
			// is just `prop` (like your original TableHelper).
			let fields: Fields
			if (typeof fieldsOrBuilder === "function") {
				const tableHelper = new Proxy(
					{},
					{
						get(_target, propKey) {
							// Return the property name itself
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
			// Use a Proxy to handle dynamic property access: db.user(...) => relation
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
						// if it's one of the known keys (like "user"), return a function that creates a relation
						if (prop in tables) {
							return (foreignKey?: string) => relationField(prop, foreignKey)
						}
						// else fall back to actual properties on target:
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

/***** 7) EXAMPLE USAGE *****/
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
		// We can reference an existing table name ("user") for a relation:
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
