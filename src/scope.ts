type BaseTypesMap = {
  string: string;
  number: number;
  boolean: boolean;
};
type BaseTypeName = keyof BaseTypesMap;

type ScopeEntry = string | { [k: string]: ScopeEntry };
type ScopeSchema = Record<string, ScopeEntry>;

type Trim<Str extends string> = Str extends ` ${infer Inner}` ? Trim<Inner>
  : Str extends `${infer Inner} ` ? Trim<Inner>
  : Str;

type Resolve<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;

type AliasMap = {
  s: "string";
  n: "number";
  b: "boolean";
};
type AliasName = keyof AliasMap;

// Resolve an alias to its full type name
type ResolveAlias<T extends string> = T extends AliasName ? AliasMap[T] : T;

// Parse a string entry in the schema
type ParseString<E extends string, S extends ScopeSchema> =
  // Handle unions
  E extends `${infer Left} | ${infer Right}`
    ? ParseString<Trim<Left>, S> | ParseString<Trim<Right>, S>
    // Handle arrays
    : E extends `${infer Inner}[]` ? ParseString<Trim<Inner>, S>[]
    // Handle aliases, base types, and references
    : ResolveAlias<Trim<E>> extends infer Resolved
      ? Resolved extends BaseTypeName ? BaseTypesMap[Resolved]
      : Resolved extends keyof S ? ParseEntry<S[Resolved], S>
      : never
    : never;

type ParseEntry<E, S extends ScopeSchema> = E extends string ? ParseString<E, S>
  : E extends object
    ? Resolve<{ -readonly [K in keyof E]: ParseEntry<E[K], S> }>
  : never;

type ResolvedScope<S extends ScopeSchema> = Resolve<
  { -readonly [K in keyof S]: ParseEntry<S[K], S> }
>;

// Define possible field types for autocompletion, including full names, aliases, and arrays
type PossibleFieldTypes<S> =
  | BaseTypeName
  | AliasName
  | keyof S
  | `${keyof S & string}[]`;

// Validate a field type string, providing autocompletion and error messages
type ValidateFieldType<S, T extends string> = T extends PossibleFieldTypes<S>
  ? T
  : {
    [K in PossibleFieldTypes<S>]: K extends `${T}${string}` ? K : never;
  }[PossibleFieldTypes<S>] extends infer Suggestion
    ? Suggestion extends string ? Suggestion
    : `Invalid field type '${T}'. Did you mean one of: ${
      & PossibleFieldTypes<S>
      & string}`
  : never;

// Validate the schema to ensure all field types are valid and provide autocompletion
type ValidatedScopeSchema<S> = {
  [K in keyof S]: {
    [F in keyof S[K]]: S[K][F] extends string ? ValidateFieldType<S, S[K][F]>
      : S[K][F] extends object ? ValidatedScopeSchema<S[K][F]>
      : never;
  };
};

function scope<const S extends ScopeSchema>(
  schema: ValidatedScopeSchema<S>,
): ResolvedScope<S> {
  return schema as any;
}

const mySchema = scope({
  user: {
    id: "string",
    tags: "tag[]",
  },
  book: {
    id: "string",
    tags: "tag[]",
  },
  tag: {
    id: "string",
    name: "string",
  },
});

type User = typeof mySchema.user;
type Book = typeof mySchema.book;
type Tag = typeof mySchema.tag;
