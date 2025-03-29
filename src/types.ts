/**
 * Core type definitions for the ORM
 */

// Record of field definitions for a table
export interface FieldsRecord {
  [key: string]: any;
}

// Type for creating table objects
export type MakeTableObject<T extends Record<string, any>> = {
  [K in keyof T]: T[K];
}; 