type BaseTypesMap = {
  string: string;
  number: number;
  boolean: boolean;
};
type BaseTypeName = keyof BaseTypesMap;

type DbScopeEntry = string | {
  [k: string]: DbScopeEntry;
};
type DbScopeSchema = Record<string, DbScopeEntry>;

type Trim<Str extends string> = Str extends
  ` ${infer Inner}` ? Trim<Inner>
  : Str extends `${infer Inner} ` ? Trim<Inner>
  : Str;

type Resolve<T> = T extends infer U
  ? { [K in keyof U]: U[K] }
  : never;

type AliasMap = {
  s: "string";
  n: "number";
  b: "boolean";
};
type AliasName = keyof AliasMap;

type ResolveAlias<T extends string> = T extends
  AliasName ? AliasMap[T]
  : T;

type ParseFieldDefinition<
  E extends string,
  S extends DbScopeSchema,
> = E extends `${infer Type}.${infer Modifiers}`
  ? {
    type: ParseFieldType<Type, S>;
    modifiers: ParseModifiers<Modifiers>;
  }
  : {
    type: ParseFieldType<E, S>;
    modifiers: {};
  };

type ParseFieldType<
  E extends string,
  S extends DbScopeSchema,
> = E extends `${infer Left} | ${infer Right}` ?
    | ParseFieldType<Trim<Left>, S>
    | ParseFieldType<Trim<Right>, S>
  : E extends `${infer Inner}[]`
    ? ParseFieldType<Trim<Inner>, S>[]
  : ResolveAlias<Trim<E>> extends infer Resolved
    ? Resolved extends BaseTypeName
      ? BaseTypesMap[Resolved]
    : Resolved extends keyof S
      ? ParseEntry<S[Resolved], S>
    : never
  : never;

type ParseModifiers<Mods extends string> =
  Mods extends "" ? {}
    : Mods extends `${infer Mod}.${infer Rest}`
      ? ParseModifier<Mod> & ParseModifiers<Rest>
    : ParseModifier<Mods>;

type ParseModifier<Mod extends string> =
  Mod extends "id" ? { id: true }
    : Mod extends "unique" ? { unique: true }
    : Mod extends "default(uuid)"
      ? { default: "uuid" }
    : Mod extends "default(autoincrement)"
      ? { default: "autoincrement" }
    : Mod extends
      `relation(${infer ForeignKeyField}.${infer ReferencedField})`
      ? {
        relation: {
          foreignKeyField: ForeignKeyField;
          referencedField: ReferencedField;
        };
      }
    : Mod extends "relation" ? { relation: true }
    : {};

type ParseEntry<E, S extends DbScopeSchema> =
  E extends string
    ? ParseFieldDefinition<E, S>["type"]
    : E extends object ? Resolve<
        {
          -readonly [K in keyof E]: ParseEntry<
            E[K],
            S
          >;
        } & ResolveRelationFields<E, S>
      >
    : never;

type ResolveRelationFields<
  E,
  S extends DbScopeSchema,
> = {
  [
    K in keyof E as E[K] extends string
      ? ParseFieldDefinition<
        E[K],
        S
      >["modifiers"] extends {
        relation: {
          foreignKeyField: infer ForeignKeyField
            extends string; // Add constraint here
        };
      } ? ForeignKeyField
      : never
      : never
  ]: string;
};

type ResolvedDbScope<S extends DbScopeSchema> =
  Resolve<
    {
      -readonly [K in keyof S]: ParseEntry<
        S[K],
        S
      >;
    }
  >;

type PossibleFieldTypes<S> =
  | BaseTypeName
  | AliasName
  | keyof S
  | `${keyof S & string}[]`;

type PossibleModifiers =
  | "id"
  | "unique"
  | "default(uuid)"
  | "default(autoincrement)"
  | "relation"
  | `relation${string}`;

type PossibleFields<S, Model extends keyof S> =
  keyof S[Model];

type ValidateFieldDefinition<
  S,
  T extends string,
> = T extends `${infer Type}.${infer Modifiers}`
  ? `${ValidateType<S, Type>}${ValidateModifiers<
    S,
    Modifiers,
    Type
  >}`
  : ValidateType<S, T>;

type ValidateType<S, T extends string> = T extends
  PossibleFieldTypes<S> ? T
  : {
    [K in PossibleFieldTypes<S>]: K extends
      `${T}${string}` ? K
      : never;
  }[PossibleFieldTypes<S>] extends
    infer Suggestion
    ? Suggestion extends string ? Suggestion
    : `Invalid field type '${T}'. Did you mean one of: ${
      & PossibleFieldTypes<S>
      & string}`
  : never;

type ExtractModel<Type extends string> =
  Type extends `${infer Model}[]` ? Model
    : Type;

type ValidateModifiers<
  S,
  Mods extends string,
  Type extends string,
> = Mods extends "" ? ""
  : Mods extends
    `${infer Mod extends string}.${infer Rest
      extends string}` // Add constraints here
    ? `.${ValidateModifier<
      S,
      Mod,
      Type
    >}${ValidateModifiers<S, Rest, Type>}`
  : `.${ValidateModifier<S, Mods, Type>}`;

type ValidateModifier<
  S,
  Mod extends string,
  Type extends string,
> = Mod extends PossibleModifiers
  ? Mod extends
    `relation(${infer ForeignKeyField}.${infer ReferencedField})`
    ? ExtractModel<Type> extends infer Model
      ? Type extends `${string}[]` ? "relation"
      : Model extends keyof S
        ? ForeignKeyField extends string
          ? ReferencedField extends
            PossibleFields<S, Model> ? Mod
          : `Invalid referenced field '${ReferencedField}' in model. Did you mean one of: ${
            & PossibleFields<
              S,
              Model
            >
            & string}`
        : `Invalid foreign key field '${ForeignKeyField}'`
      : `Invalid model in relation`
    : never
  : Mod
  : {
    [K in PossibleModifiers]: K extends
      `${Mod}${string}` ? K
      : never;
  }[PossibleModifiers] extends infer Suggestion
    ? Suggestion extends string ? Suggestion
    : `Invalid modifier. Did you mean one of: ${
      & PossibleModifiers
      & string}`
  : never;

type ValidatedDbScopeSchema<S> = {
  [K in keyof S]: {
    [F in keyof S[K]]: S[K][F] extends string
      ? ValidateFieldDefinition<S, S[K][F]>
      : S[K][F] extends object
        ? ValidatedDbScopeSchema<S[K][F]>
      : never;
  };
};

function schema<const S extends DbScopeSchema>(
  schema: ValidatedDbScopeSchema<S>,
): ResolvedDbScope<S> {
  return schema as any;
}

const db = schema({
  user: {
    id: "string.id",
    name: "string",
    email: "string.unique",
    tags: "tag[]",
  },
  book: {
    id: "string.id",
    title: "string",
    tags: "tag[]",
  },
  tag: {
    id: "string.id",
    name: "string",
  },
});

type User = typeof db.user;
type Book = typeof db.book;
type Tag = typeof db.tag;
