import type { TableInstance as TableInstanceType } from "./table";
import type { FieldsRecord } from "./types";

/**
 * Type definitions for table-related functionality
 */

// Re-export the TableInstance type from table.ts
export type TableInstance<
  TableName extends string,
  Fields extends FieldsRecord,
> = TableInstanceType<TableName, Fields>;

// Constructor for tables used in relations
export interface RelationTableConstructor {
  new(...args: any[]): any;
  prototype: any;
}

// Utility type to extract keys from a table constructor
export type ExtractKeys<T> = T extends { prototype: infer P } ? keyof P & string
  : string;
