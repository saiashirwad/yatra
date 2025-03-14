export function generatePrismaSchema(tables: any[]): string {
	let schema = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

`

	tables.forEach((TableClass) => {
		const table = new TableClass()
		schema += processTable(table)
	})

	return schema
}

function processTable(table: any): string {
	const tableName = pascalCase(table.name)
	let result = `model ${tableName} {\n`

	for (const [fieldName, field] of Object.entries(table.fields)) {
		result += `  ${processField(fieldName, field)}\n`
	}

	if (Object.keys(table.fields).length > 0 && Object.keys(table.relations || {}).length > 0) {
		result += "\n"
	}

	if (table.relations) {
		for (const [relationName, relation] of Object.entries(table.relations)) {
			result += `  ${processRelation(relationName, relation, table.name)}\n`
		}
	}

	result += "}\n\n"
	return result
}

function processField(name: string, field: any): string {
	const config = field.getConfig()
	const type = mapTypeToPrisma(config.type, field)
	const modifiers = []

	const isNullable = field.__nullable === true

	if (field.primaryKey === true) {
		modifiers.push("@id")
	}

	if (field.unique === true) {
		modifiers.push("@unique")
	}

	const defaultValue = extractDefaultValue(field)
	if (defaultValue !== undefined) {
		modifiers.push(`@default(${formatDefaultValue(defaultValue, config.type)})`)
	}

	if (
		config.type === "uuid" &&
		field.primaryKey === true &&
		!modifiers.includes("@default(uuid())")
	) {
		modifiers.push("@default(uuid())")
	}

	let fieldDef = `${name} ${type}`

	if (isNullable) {
		fieldDef += "?"
	}

	if (modifiers.length > 0) {
		fieldDef += ` ${modifiers.join(" ")}`
	}

	return fieldDef
}

function processRelation(name: string, relation: any, tableName: string): string {
	switch (relation.kind) {
		case "many-to-one": {
			const refTable = relation.ref().name
			const refTablePascal = pascalCase(refTable)
			return `${name} ${refTablePascal} @relation(fields: [${relation.virtualField}], references: [${relation.foreignKey}])`
		}
		case "one-to-many": {
			const refTable = relation.ref().name
			const refTablePascal = pascalCase(refTable)
			return `${name} ${refTablePascal}[] @relation("${refTablePascal}To${pascalCase(tableName)}")`
		}
		case "one-to-one": {
			const refTable = relation.ref().name
			const refTablePascal = pascalCase(refTable)
			return `${name} ${refTablePascal}? @relation(fields: [${relation.virtualField}], references: [${relation.foreignKey}])`
		}
		default:
			return `// Unknown relation type: ${relation.kind}`
	}
}

function mapTypeToPrisma(type: string, field?: any): string {
	switch (type) {
		case "string":
			return "String"
		case "number":
			return "Float"
		case "boolean":
			return "Boolean"
		case "date":
			return "DateTime"
		case "json":
		case "jsonb":
			return "Json"
		case "uuid":
			return "String"
		case "text":
			return "String"
		case "bigint":
			return "BigInt"
		case "timestamp":
			return "DateTime"
		case "time":
			return "String"
		case "decimal":
			return "Decimal"
		case "array":
			if (field && field.itemType) {
				const itemType = field.itemType.getConfig().type
				return `${mapTypeToPrisma(itemType)}[]`
			}
			return "String[]"
		case "enum":
			if (field && field.values && Array.isArray(field.values)) {
				return "String"
			}
			return "String"
		default:
			return "String"
	}
}

function extractDefaultValue(field: any): any {
	if (field.default === undefined) {
		return undefined
	}

	if (
		typeof field.default === "string" ||
		typeof field.default === "number" ||
		typeof field.default === "boolean"
	) {
		return field.default
	}

	const config = field.getConfig()

	if (config.type === "uuid") {
		return "uuid()"
	}

	if (config.type === "enum" && Array.isArray(config.values) && config.values.length > 0) {
		return config.values[0]
	}

	return undefined
}

function formatDefaultValue(value: any, type: string): string {
	if (value === "uuid()") {
		return "uuid()"
	}

	if (type === "string" || type === "text") {
		return `"${value}"`
	} else if (type === "boolean") {
		return value ? "true" : "false"
	} else if (type === "json" || type === "jsonb") {
		return `dbgenerated("'${JSON.stringify(value).replace(/"/g, '\\"')}'")`
	} else {
		return String(value)
	}
}

function pascalCase(str: string): string {
	return str
		.split(/[_-\s]/)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join("")
}
