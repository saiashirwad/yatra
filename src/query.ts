import type { IsNullable } from "./columns/properties.ts"
import type { TableRelations } from "./relation.ts"
import type { InferColumn } from "./table.ts"
import type {
  Clean,
  Tableish,
  TableishFields
} from "./utils.ts"

// ---------------------------------------------------------------------------
// Query context
// ---------------------------------------------------------------------------

export type Mode = "flat" | "hydrate"

export type WhereOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "like"
  | "ilike"
  | "in"
  | "not in"
  | "is"
  | "is not"

export interface WhereClause {
  readonly path: string
  readonly op: WhereOperator
  readonly value: unknown
}

export interface OrderByClause {
  readonly path: string
  readonly direction: "asc" | "desc"
}

/**
 * The immutable query description that flows through the pipe.
 * Only the type parameters that influence the result shape are
 * tracked at the type level (`Mode` and `Items`); everything else
 * is plain runtime data.
 */
export interface QueryContext<
  T extends Tableish,
  M extends Mode = "flat",
  Items extends readonly unknown[] = readonly []
> {
  readonly table: T
  readonly mode: M
  readonly selection: Items
  readonly where: readonly WhereClause[]
  readonly orderBy: readonly OrderByClause[]
  readonly limit?: number
  readonly offset?: number
}

export function query<T extends Tableish>(
  table: T
): QueryContext<T> {
  return {
    table,
    mode: "flat",
    selection: [],
    where: [],
    orderBy: []
  }
}

// ---------------------------------------------------------------------------
// Composable aggregate blocks: jsonAgg / count
// ---------------------------------------------------------------------------

export const AggSpecSym = Symbol.for("Yatra/AggSpec")

export type AggKind = "array" | "count"

/**
 * A composable selection block. Created standalone (e.g. `jsonAgg`)
 * and dropped into `select(...)`; the block is validated and typed
 * against whichever table the `select` applies to — so blocks can be
 * built once and reused across queries.
 */
export interface AggSpec<
  Rel extends string = string,
  Items extends readonly unknown[] = readonly unknown[],
  Alias extends string | undefined = string | undefined,
  Kind extends AggKind = AggKind
> {
  readonly [AggSpecSym]: true
  readonly kind: Kind
  readonly relation: Rel
  readonly items: Items
  readonly alias: Alias
}

export function isAggSpec(x: unknown): x is AggSpec {
  return (
    typeof x === "object" && x !== null && AggSpecSym in x
  )
}

/** Aggregate a relation into a JSON array column (jsonb_agg). */
export function jsonAgg<
  const Rel extends string,
  const Items extends readonly unknown[],
  const Alias extends string | undefined = undefined
>(
  relation: Rel,
  items: Items,
  opts?: { as?: Alias }
): AggSpec<Rel, Items, Alias, "array"> {
  return {
    [AggSpecSym]: true,
    kind: "array",
    relation,
    items,
    alias: opts?.as as Alias
  }
}

/** Count the rows of a relation into a number column. */
export function count<
  const Rel extends string,
  const Alias extends string | undefined = undefined
>(
  relation: Rel,
  opts?: { as?: Alias }
): AggSpec<Rel, readonly [], Alias, "count"> {
  return {
    [AggSpecSym]: true,
    kind: "count",
    relation,
    items: [],
    alias: opts?.as as Alias
  }
}

// ---------------------------------------------------------------------------
// Type-level path machinery
// ---------------------------------------------------------------------------

type FieldsOf<T extends Tableish> = TableishFields<T>
type RelsOf<T extends Tableish> = TableRelations<T>
type FieldName<T extends Tableish> = keyof FieldsOf<T> &
  string
type RelName<T extends Tableish> = keyof RelsOf<T> & string

type DestOf<T extends Tableish, Rel extends string> =
  Rel extends RelName<T> ?
    RelsOf<T>[Rel] extends { destinationTable: infer D } ?
      D extends Tableish ?
        D
      : never
    : never
  : never

type IsToOne<R> =
  R extends { type: "one-to-one" | "many-to-one" } ? true
  : false

type Or<A, B> = A extends true ? true : B

/** The TS value type found at the end of a (possibly dotted) path. */
export type PathValue<
  T extends Tableish,
  P extends string,
  CrossedToOne extends boolean = false
> =
  P extends `${infer Base} as ${string}` ?
    PathValue<T, Base, CrossedToOne>
  : P extends `${infer Head}.${infer Tail}` ?
    Head extends RelName<T> ?
      PathValue<
        DestOf<T, Head>,
        Tail,
        Or<CrossedToOne, IsToOne<RelsOf<T>[Head]>>
      >
    : never
  : P extends FieldName<T> ?
    CrossedToOne extends true ?
      InferColumn<FieldsOf<T>[P]> | null
    : InferColumn<FieldsOf<T>[P]>
  : never

/** Valid field continuations for a partial leaf segment. */
type FieldSuggestions<
  T extends Tableish,
  P extends string,
  Prefix extends string
> = {
  [k in FieldName<T>]: k extends `${P}${string}` ?
    `${Prefix}${k}`
  : never
}[FieldName<T>]

/** Valid relation continuations — carry a trailing dot so the next
 *  segment keeps completing (the "incremental" part). */
type RelSuggestions<
  T extends Tableish,
  P extends string,
  Prefix extends string
> = {
  [k in RelName<T>]: k extends `${P}${string}` ?
    `${Prefix}${k}.`
  : never
}[RelName<T>]

/** Validates a path string; returns the path itself when valid,
 *  or a union of valid continuations / an error string when not.
 *  Typing a partial path yields its completions, which is what powers
 *  segment-by-segment autocomplete in the editor. */
export type ValidatePath<
  T extends Tableish,
  Path extends string,
  Prefix extends string = ""
> =
  Path extends `${infer Base} as ${infer Alias}` ?
    `${ValidatePath<T, Base, Prefix>} as ${Alias}`
  : Path extends `${infer Head}.${infer Tail}` ?
    Head extends RelName<T> ?
      ValidatePath<
        DestOf<T, Head>,
        Tail,
        `${Prefix}${Head}.`
      >
    : [RelSuggestions<T, Head, Prefix>] extends [never] ?
      `Key '${Head}' is not a relation following '${Prefix}'`
    : RelSuggestions<T, Head, Prefix>
  : Path extends FieldName<T> ? `${Prefix}${Path}`
  : [
    | FieldSuggestions<T, Path, Prefix>
    | RelSuggestions<T, Path, Prefix>
  ] extends [never] ?
    `Key '${Path}' is not valid following '${Prefix}'`
  : | FieldSuggestions<T, Path, Prefix>
    | RelSuggestions<T, Path, Prefix>

export type Conform<T, Base> = T extends Base ? T : Base

/** Agg blocks select from the destination table directly, so their
 *  items are local fields (optionally aliased) or nested agg blocks —
 *  never dotted relation paths. */
type ValidateLocal<T extends Tableish, P extends string> =
  P extends `${infer Base} as ${string}` ?
    Base extends FieldName<T> ?
      P
    : FieldName<T>
  : P extends FieldName<T> ? P
  : FieldName<T>

type ValidateAggItem<T extends Tableish, Item> =
  Item extends (
    AggSpec<infer Rel, infer Sub, infer Alias, infer Kind>
  ) ?
    Rel extends RelName<T> ?
      AggSpec<
        Rel,
        ValidateAggItems<DestOf<T, Rel>, Sub>,
        Alias,
        Kind
      >
    : `'${Rel}' is not a relation of this table`
  : Item extends string ? string & ValidateLocal<T, Item>
  : "Agg items must be field names or agg blocks (jsonAgg/count)"

type ValidateAggItems<
  T extends Tableish,
  Items extends readonly unknown[]
> = {
  [K in keyof Items]: Conform<
    Items[K],
    ValidateAggItem<T, Items[K]>
  >
}

type ValidateItem<T extends Tableish, Item> =
  Item extends (
    AggSpec<infer Rel, infer Sub, infer Alias, infer Kind>
  ) ?
    Rel extends RelName<T> ?
      AggSpec<
        Rel,
        ValidateAggItems<DestOf<T, Rel>, Sub>,
        Alias,
        Kind
      >
    : `'${Rel}' is not a relation of this table`
  : Item extends string ? string & ValidatePath<T, Item>
  : "Selection items must be path strings or agg blocks (jsonAgg/count)"

type ValidateItems<
  T extends Tableish,
  Items extends readonly unknown[]
> = {
  // NoInfer keeps the suggestion union from polluting inference of
  // Items — without it, template-literal inference leaks partial
  // candidates ("id" | "i") into the captured tuple.
  [K in keyof Items]: Conform<
    Items[K],
    ValidateItem<T, NoInfer<Items[K]>>
  >
}

type WhereInput<V, Op> =
  Op extends "in" | "not in" ? readonly NonNullable<V>[]
  : Op extends "is" | "is not" ? null
  : V

// ---------------------------------------------------------------------------
// Result-shape computation
// ---------------------------------------------------------------------------

type WrapCardinality<Rel, Inner> =
  Rel extends { type: "one-to-many" | "many-to-many" } ?
    Inner[]
  : Inner | null

type KeyOf<Rel extends string, Alias> =
  Alias extends string ? Alias : Rel

type MergeVal<A, B> =
  NonNullable<A> extends readonly (infer X)[] ?
    NonNullable<B> extends readonly (infer Y)[] ?
      Merge<X, Y>[] | Extract<A, null> | Extract<B, null>
    : B
  : NonNullable<A> extends object ?
    NonNullable<B> extends object ?
      | Merge<NonNullable<A>, NonNullable<B>>
      | Extract<A, null>
      | Extract<B, null>
    : B
  : B

type Merge<A, B> = Clean<{
  [K in keyof A | keyof B]: K extends keyof B ?
    K extends keyof A ?
      MergeVal<A[K], B[K]>
    : B[K]
  : K extends keyof A ? A[K]
  : never
}>

type StringContribution<
  T extends Tableish,
  M extends Mode,
  P extends string
> =
  P extends `${infer Base} as ${infer Alias}` ?
    {
      [K in Alias]:
        | PathValue<T, Base>
        | (M extends "flat" ?
            Base extends `${string}.${string}` ?
              null
            : never
          : never)
    }
  : P extends `${infer Head}.${infer Tail}` ?
    Head extends RelName<T> ?
      M extends "hydrate" ?
        {
          [K in Head]: WrapCardinality<
            RelsOf<T>[Head],
            MergeAll<DestOf<T, Head>, M, readonly [Tail]>
          >
        }
      : { [K in P]: PathValue<T, P> | null }
    : {}
  : P extends FieldName<T> ?
    { [K in P]: InferColumn<FieldsOf<T>[P]> }
  : {}

type Contribution<
  T extends Tableish,
  M extends Mode,
  Item
> =
  Item extends (
    AggSpec<infer Rel, infer Sub, infer Alias, infer Kind>
  ) ?
    Rel extends RelName<T> ?
      Kind extends "count" ?
        { [K in KeyOf<Rel, Alias>]: number }
      : {
          [K in KeyOf<Rel, Alias>]: MergeAll<
            DestOf<T, Rel>,
            "hydrate",
            Sub
          >[]
        }
    : {}
  : Item extends string ? StringContribution<T, M, Item>
  : {}

type MergeAll<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[],
  Acc = {}
> =
  Items extends readonly [infer H, ...infer Rest] ?
    MergeAll<T, M, Rest, Merge<Acc, Contribution<T, M, H>>>
  : Clean<Acc>

/** The row shape produced by a query. */
export type Row<Ctx> =
  Ctx extends QueryContext<infer T, infer M, infer Items> ?
    MergeAll<T, M, Items>
  : never

/** The full result (array of rows) produced by a query. */
export type Result<Ctx> =
  Ctx extends QueryContext<infer T, infer M, infer Items> ?
    MergeAll<T, M, Items>[]
  : never

// ---------------------------------------------------------------------------
// Pipe steps
//
// Each step is generic over the table `T` but `T` never appears in the
// arguments — the pipe infers it from the previous step through the
// returned function's parameter. That lets validation live directly in
// the argument types (Conform<arg, Validate…<T, arg>>), which is what
// makes the editor offer completions *while you type* (see
// playground/blass.ts for the minimal version of the trick).
// ---------------------------------------------------------------------------

export function select<
  T extends Tableish,
  const Items extends readonly unknown[]
>(
  ...items: ValidateItems<T, Items>
): <M extends Mode>(
  ctx: QueryContext<T, M, any>
) => QueryContext<T, M, Items> {
  return (ctx => ({
    ...ctx,
    selection: items as unknown as Items
  })) as <M extends Mode>(
    ctx: QueryContext<T, M, any>
  ) => QueryContext<T, M, Items>
}

export function hydrate<
  T extends Tableish,
  Items extends readonly unknown[]
>(
  ctx: QueryContext<T, "flat", Items>
): QueryContext<T, "hydrate", Items> {
  return { ...ctx, mode: "hydrate" }
}

export function where<
  T extends Tableish,
  const P extends string,
  const Op extends WhereOperator,
  const V extends WhereInput<PathValue<T, P>, Op>
>(
  path: Conform<P, string & ValidatePath<T, NoInfer<P>>>,
  op: Op,
  value: V
): <M extends Mode, Items extends readonly unknown[]>(
  ctx: QueryContext<T, M, Items>
) => QueryContext<T, M, Items> {
  return (ctx => ({
    ...ctx,
    where: [
      ...ctx.where,
      { path, op, value } as WhereClause
    ]
  })) as <M extends Mode, Items extends readonly unknown[]>(
    ctx: QueryContext<T, M, Items>
  ) => QueryContext<T, M, Items>
}

export function orderBy<
  T extends Tableish,
  const P extends string,
  const Dir extends "asc" | "desc" = "asc"
>(
  path: Conform<P, string & ValidatePath<T, NoInfer<P>>>,
  direction: Dir = "asc" as Dir
): <M extends Mode, Items extends readonly unknown[]>(
  ctx: QueryContext<T, M, Items>
) => QueryContext<T, M, Items> {
  return (ctx => ({
    ...ctx,
    orderBy: [
      ...ctx.orderBy,
      { path, direction } as OrderByClause
    ]
  })) as <M extends Mode, Items extends readonly unknown[]>(
    ctx: QueryContext<T, M, Items>
  ) => QueryContext<T, M, Items>
}

export function limit<const N extends number>(n: N) {
  return <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[]
  >(
    ctx: QueryContext<T, M, Items>
  ): QueryContext<T, M, Items> => {
    return { ...ctx, limit: n }
  }
}

export function offset<const N extends number>(n: N) {
  return <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[]
  >(
    ctx: QueryContext<T, M, Items>
  ): QueryContext<T, M, Items> => {
    return { ...ctx, offset: n }
  }
}
