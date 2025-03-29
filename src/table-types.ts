import type { FieldsRecord } from "./types";

/**
 * Type definitions for table-related functionality
 */

export interface TableInstance<
  TableName extends string,
  Fields extends FieldsRecord,
> {
  constructor: RelationTableConstructor;
}

export interface RelationTableConstructor {
  new(...args: any[]): any;
  prototype: any;
}

export type ExtractKeys<T> = T extends { prototype: infer P } ? keyof P & string
  : string;
