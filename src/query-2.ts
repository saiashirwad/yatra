import type { TableRelations } from "./relation";
import { type GetTableFields, TableName } from "./table";
import type {
  Clean,
  Tableish,
  TableishFields,
} from "./utils";

type QueryState = {
  readonly _selection?: unknown;
  readonly _joins?: unknown;
  readonly _where?: unknown;
  readonly _orderBy?: unknown;
};

export type QualifiedField<T extends Tableish> = T extends
  Tableish<infer TName, infer F> ? {
    [K in keyof F & string]: `${TName}.${K}`;
  }[keyof F & string]
  : never;

export function qualifiedField<T extends Tableish>(
  table: T,
  field: QualifiedField<T>,
): QualifiedField<T> {
  return `${
    table.prototype[TableName]
  }.${field}` as QualifiedField<T>;
}

export type GetField<T extends Tableish, Key> = Key extends
  keyof TableishFields<T> ? TableishFields<T>[Key] : never;

export type GetRelation<T extends Tableish, Key> =
  Key extends keyof TableRelations<T>
    ? TableRelations<T>[Key]["destinationTable"]
    : never;

export type GetPath<T extends Tableish, Path> = Path extends
  `${infer Head}.${infer Tail}`
  ? GetPath<GetRelation<T, Head>, Tail>
  : GetField<T, Path>;
