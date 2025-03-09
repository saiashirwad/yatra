//type ColumnType = "string" | "number" | "boolean" | "date" | "json";

abstract class BaseColumn<T> {
	constructor(public readonly type: string) {}
}
class Column<T> {}

