import type { TableRelations } from "./relation";
import { TableName } from "./table";
import type { Tableish, TableishFields } from "./utils";

type QueryState = {
  readonly _selection?: unknown;
  readonly _joins?: unknown;
  readonly _where?: unknown;
  readonly _orderBy?: unknown;
};

export type QueryContext<
  T extends Tableish,
  State extends QueryState = {},
  Selected extends ReadonlyArray<string> = readonly [],
> = {
  readonly table: T;
  readonly selected: Selected;
  readonly state: State;
};

export function query<T extends Tableish>(
  table: T,
): QueryContext<T> {
  return {
    table,
    selected: [] as const,
    state: {},
  };
}

export function select<
  T extends Tableish,
  State extends QueryState,
  const Paths extends ReadonlyArray<string>,
>(...paths: [...{ [K in keyof Paths]: Conform<Paths[K], string & ValidatePath<T, Paths[K]>> }]) {
  return (
    ctx: QueryContext<T, State>,
  ): QueryContext<
    T,
    State & { _selection: true },
    typeof paths
  > => {
    return {
      ...ctx,
      selected: paths,
      state: {
        ...ctx.state,
        _selection: true,
      } as State & { _selection: true },
    };
  };
}

export type QualifiedField<T extends Tableish> = T extends Tableish<infer TName, infer F> ? {
    [K in keyof F & string]: `${TName}.${K}`;
  }[keyof F & string]
  : never;

export function qualifiedField<T extends Tableish>(
  table: T,
  field: QualifiedField<T>,
): QualifiedField<T> {
  return `${table.prototype[TableName]}.${field}` as QualifiedField<T>;
}

export type GetField<T extends Tableish, Key> = Key extends keyof TableishFields<T>
  ? TableishFields<T>[Key]
  : never;

export type GetRelation<T extends Tableish, Key> = Key extends keyof TableRelations<T>
  ? TableRelations<T>[Key]["destinationTable"]
  : never;

type AliasedField<T, Alias> = {
  readonly field: T;
  readonly alias: Alias;
};

export type GetPath<T extends Tableish, Path> = Path extends `${infer BasePath} as ${infer Alias}`
  ? AliasedField<GetPath<T, BasePath>, Alias>
  : Path extends `${infer Head}.${infer Tail}` ? GetPath<GetRelation<T, Head>, Tail>
  : GetField<T, Path>;

type ValidatePath<T extends Tableish, Path extends string, Prefix extends string = ""> =
  Path extends `${infer BasePath} as ${infer Alias}`
    ? `${ValidatePath<T, BasePath, Prefix>} as ${Alias}`
    : Path extends `${infer Head}.${infer Tail}`
      ? Head extends keyof TableRelations<T>
        ? ValidatePath<GetRelation<T, Head>, Tail, `${Prefix}${Head}.`>
      : `Key '${Head}' is not valid following '${Prefix}'`
    : Path extends keyof TableishFields<T> ? `${Prefix}${Path}`
    : {
      [k in keyof TableishFields<T>]: k extends `${Path}${string}` ? `${Prefix}${k}` : never;
    }[keyof TableishFields<T>];

export type Conform<T, Base> = T extends Base ? T : Base;

export function get<
  const T extends Tableish,
  Path extends string,
>(
  table: T,
  pathStr: Conform<Path, string & ValidatePath<T, Path>>,
): GetPath<T, Path> {
  // Implementation will be added later
  // This should parse the path and handle aliases
  return {} as any;
}
