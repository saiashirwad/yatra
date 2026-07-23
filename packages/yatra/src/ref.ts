import type {
  Relation,
  RelationType,
  TableRelations
} from "./relation.ts"
import { info, type InferColumn } from "./table.ts"
import type {
  Clean,
  Tableish,
  TableishFields
} from "./utils.ts"
export const RefData = Symbol.for("Yatra/Ref/Data")
export type Mode = "flat" | "hydrate"
/**
 * The ops core's own builders use. The IR itself is open: `PredData.op`
 * is a plain string, so op packs can add their own (docs/compiler-composition.md).
 */
export type CorePredOp =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "like"
  | "ilike"
  | "in"
  | "isNull"
  | "isNotNull"
  | "and"
  | "or"
  | "not"
  | "exists"
export interface ChainLink {
  readonly name: string
  readonly rel: RelationType
}
// --- runtime node data ---
export interface ColData {
  readonly kind: "col"
  readonly chain: readonly string[]
  readonly key: string
}
/** A raw JS value. Every non-node op argument is wrapped in `lit` at
 * build time, so interpreters never guess whether something is a node. */
export interface LitData {
  readonly kind: "lit"
  readonly value: unknown
}
export interface ExprData {
  readonly kind: "expr"
  readonly op: string
  readonly args: readonly NodeData[]
}
export interface AliasData {
  readonly kind: "as"
  readonly target: NodeData
  readonly alias: string
}
export interface AggData {
  readonly kind: "agg"
  readonly aggKind: string
  readonly relation: Relation<any, any>
  readonly key: string
  readonly items: readonly NodeData[]
  /** sub-shape filters (docs/shapes.md): each author with their
   * 5 cheapest books — applied inside the agg's own scope */
  readonly where?: readonly NodeData[]
  readonly order?: readonly OrderData[]
  readonly limit?: LitData
}
export interface PredData {
  readonly kind: "pred"
  readonly op: string
  readonly args: readonly NodeData[]
}
export interface OrderData {
  readonly kind: "order"
  readonly direction: "asc" | "desc"
  readonly ref: NodeData
}
export interface RelData {
  readonly kind: "rel"
  readonly relation: Relation<any, any>
  readonly key: string
  readonly chain: readonly string[]
}
export type NodeData =
  | ColData
  | LitData
  | ExprData
  | AliasData
  | AggData
  | PredData
  | OrderData
  | RelData
// --- type-level node brands ---
// Every ref carries a phantom `Root`: the table whose accessor the ref
// was born from. Query steps reject refs rooted at a different table.
// `any` (the default) means unbranded — fragments and custom ops stay
// table-agnostic.
export interface ColRef<
  V = any,
  Key extends string = string,
  Chain extends readonly ChainLink[] = readonly ChainLink[],
  Root = any
> {
  readonly [RefData]: {
    readonly kind: "col"
    readonly value: V
    readonly key: Key
    readonly chain: Chain
    readonly root: Root
  }
}
export interface ExprRef<V = any, Root = any> {
  readonly [RefData]: {
    readonly kind: "expr"
    readonly value: V
    readonly root: Root
  }
}
export interface AliasedRef<
  V = any,
  Alias extends string = string,
  Chain extends readonly ChainLink[] = readonly ChainLink[],
  Root = any
> {
  readonly [RefData]: {
    readonly kind: "as"
    readonly value: V
    readonly alias: Alias
    readonly chain: Chain
    readonly root: Root
  }
}
export interface AggRef<
  V = any,
  Key extends string = string,
  Root = any
> {
  readonly [RefData]: {
    readonly kind: "agg"
    readonly value: V
    readonly key: Key
    readonly root: Root
  }
}
export interface RelRef<
  D extends Tableish = Tableish,
  Key extends string = string,
  Root = any
> {
  readonly [RefData]: {
    readonly kind: "rel"
    readonly dest: D
    readonly key: Key
    readonly root: Root
  }
}
export interface PredRef<Root = any> {
  readonly [RefData]: {
    readonly kind: "pred"
    readonly root: Root
  }
}
export interface OrderRef<Root = any> {
  readonly [RefData]: {
    readonly kind: "order"
    readonly direction: "asc" | "desc"
    readonly root: Root
  }
}
/**
 * Phantom only (never exists at runtime): the row contribution of an
 * object-shape select. The runtime selection holds the desugared
 * nodes; this carries the record shape into `MergeAll`.
 */
export interface ShapeRef<R = any> {
  readonly [RefData]: {
    readonly kind: "shape"
    readonly row: R
  }
}
/** Extract the root-table brand from any ref (`any` = unbranded). */
export type RootOf<R> = R extends {
  readonly [RefData]: { readonly root: infer Rt }
}
  ? Rt
  : never
export function mk<N extends NodeData>(data: N): any {
  return { [RefData]: data }
}
export function dataOf(x: unknown): NodeData | undefined {
  if (typeof x === "object" && x !== null && RefData in x) {
    return (x as any)[RefData]
  }
  return undefined
}
export function needData(x: unknown): NodeData {
  const d = dataOf(x)
  if (!d) {
    throw new Error("Expected a yatra node")
  }
  return d
}
/** Wrap a raw JS value as a `lit` node — builders use this for every
 * non-node argument so interpreters see only bare `NodeData`. */
export const lit = (value: unknown): LitData => ({
  kind: "lit",
  value
})
/**
 * Stable identity for a selection item. Selecting the same path twice
 * is idempotent (see query.ts `select`), and compilers key result
 * columns by it.
 */
export function selectionKey(
  data: NodeData
): string | undefined {
  switch (data.kind) {
    case "col":
      return `col:${[...data.chain, data.key].join(".")}`
    case "as":
      return `as:${data.alias}`
    case "agg":
      return `agg:${data.key}`
    default:
      return undefined
  }
}
// --- accessor ---
type FieldsOf<T extends Tableish> = TableishFields<T>
type RelsOf<T extends Tableish> = TableRelations<T>
type RelAccess<
  R,
  K extends string,
  Chain extends readonly ChainLink[],
  Root
> =
  R extends Relation<any, infer D>
    ? D extends Tableish
      ? R["type"] extends infer RT extends RelationType
        ? Accessor<
            D,
            readonly [
              ...Chain,
              { readonly name: K; readonly rel: RT }
            ],
            Root
          > &
            RelRef<D, K, Root>
        : never
      : never
    : never
export type Accessor<
  T extends Tableish,
  Chain extends readonly ChainLink[] = readonly [],
  Root = any
> = {
  readonly [K in keyof FieldsOf<T> & string]: ColRef<
    InferColumn<FieldsOf<T>[K]>,
    K,
    Chain,
    Root
  >
} & {
  readonly [K in keyof RelsOf<T> & string]: RelAccess<
    RelsOf<T>[K],
    K,
    Chain,
    Root
  >
}
/**
 * The accessor a query/mutation callback receives: rooted at the
 * query's own table, so refs from other tables can't slip in.
 */
export type QueryAccessor<T extends Tableish> = Accessor<
  T,
  readonly [],
  T
>
/**
 * An accessor with any chain and any root — the parameter type for
 * reusable fragments (`(b: AnyAccessor<typeof Book>) => ...`).
 * Chain-generic: works at the root and behind any relation. The
 * trade-off: values come back widened (`| null`), since the type
 * can't know whether the fragment ran at the root or behind a join.
 */
export type AnyAccessor<T extends Tableish> = Accessor<
  T,
  any,
  any
>
/** A chain-generic selection fragment — the signature every reusable
 * fragment needs, so users don't have to remember it. Tuple fragments
 * must return inline tuples (`as const`) to keep their row type. */
export type SelFrag<T extends Tableish> = <
  Chain extends readonly ChainLink[]
>(
  t: Accessor<T, Chain>
) => readonly unknown[] | Record<string, unknown>
/** A chain-generic predicate fragment. */
export type PredFrag<T extends Tableish> = <
  Chain extends readonly ChainLink[]
>(
  t: Accessor<T, Chain>
) => PredRef<any> | readonly PredRef<any>[]
export function accessor<T extends Tableish>(
  table: T,
  chain: readonly string[] = []
): QueryAccessor<T> {
  return new Proxy(
    {},
    {
      get(_, prop) {
        if (typeof prop !== "string" || prop === "then") {
          return undefined
        }
        const { fields, relations } = info(table)
        if (prop in fields) {
          return mk({ kind: "col", chain, key: prop })
        }
        const relation = relations[prop]
        if (relation) {
          return relAccessor(relation, prop, chain)
        }
        return undefined
      }
    }
  ) as QueryAccessor<T>
}
function relAccessor(
  relation: Relation<any, any>,
  key: string,
  parentChain: readonly string[]
): unknown {
  const chain = [...parentChain, key]
  const dest = relation.destinationTable
  const data: RelData = {
    kind: "rel",
    relation,
    key,
    chain
  }
  const target = { [RefData]: data }
  return new Proxy(target, {
    get(t, prop) {
      if (prop === RefData) {
        return (t as any)[RefData]
      }
      if (typeof prop !== "string" || prop === "then") {
        return undefined
      }
      const { fields, relations } = info(dest)
      if (prop in fields) {
        return mk({ kind: "col", chain, key: prop })
      }
      const rel = relations[prop]
      if (rel) {
        return relAccessor(rel, prop, chain)
      }
      return undefined
    }
  })
}
// --- selection item validation ---
type WrongRoot =
  "This ref belongs to a different table — refs can't be shared across queries"
export type CheckItem<Item, Root = any> = Item extends
  | ColRef<any, any, any>
  | AliasedRef<any, any, any>
  | AggRef<any, any>
  ? [RootOf<Item>] extends [Root]
    ? Item
    : WrongRoot
  : Item extends ExprRef<any>
    ? "Expressions need an alias: as(expr, 'name')"
    : "Selection items must be a column ref (t.id), an aliased expression as(expr, 'name'), or an aggregation jsonAgg(t.rel, ...)/count(t.rel) — a bare relation is not selectable"
type Conform<T, Base> = T extends Base ? T : Base
export type CheckItems<
  Items extends readonly unknown[],
  Root = any
> = {
  [K in keyof Items]: Conform<
    Items[K],
    CheckItem<NoInfer<Items[K]>, Root>
  >
}
/**
 * A pre-built array (`ColRef[]`) widens and would silently drop every
 * field from the row type — require an inline tuple instead.
 */
export type RequireTuple<Items extends readonly unknown[]> =
  number extends Items["length"]
    ? Record<
        "selection must be an inline tuple (t => [t.id, ...] or `as const`) — a pre-built array loses its row type",
        never
      >
    : unknown
// --- row shape computation ---
type MergeVal<A, B> =
  NonNullable<A> extends readonly (infer X)[]
    ? NonNullable<B> extends readonly (infer Y)[]
      ? Merge<X, Y>[] | Extract<A, null> | Extract<B, null>
      : B
    : NonNullable<A> extends object
      ? NonNullable<B> extends object
        ?
            | Merge<NonNullable<A>, NonNullable<B>>
            | Extract<A, null>
            | Extract<B, null>
        : B
      : B
export type Merge<A, B> = Clean<{
  [K in keyof A | keyof B]: K extends keyof B
    ? K extends keyof A
      ? MergeVal<A[K], B[K]>
      : B[K]
    : K extends keyof A
      ? A[K]
      : never
}>
type JoinPath<
  Chain extends readonly ChainLink[],
  Key extends string
> = Chain extends readonly [
  infer H extends ChainLink,
  ...infer Rest extends readonly ChainLink[]
]
  ? `${H["name"]}.${JoinPath<Rest, Key>}`
  : Key
type NestChain<
  V,
  Key extends string,
  Chain extends readonly ChainLink[]
> = Chain extends readonly [
  infer H extends ChainLink,
  ...infer Rest extends readonly ChainLink[]
]
  ? {
      [K in H["name"]]: H["rel"] extends
        | "one-to-many"
        | "many-to-many"
        ? NestChain<V, Key, Rest>[]
        : NestChain<V, Key, Rest> | null
    }
  : { [K in Key]: V }
export type Contribution<M extends Mode, Item> =
  Item extends ShapeRef<infer R>
    ? R
    : Item extends AggRef<infer V, infer K>
      ? { [Key in K]: V }
      : Item extends AliasedRef<
            infer V,
            infer A,
            infer Chain
          >
        ? {
            [Key in A]: Chain extends readonly []
              ? V
              : V | null
          }
        : Item extends ColRef<infer V, infer K, infer Chain>
          ? Chain extends readonly []
            ? { [Key in K]: V }
            : M extends "flat"
              ? { [Key in JoinPath<Chain, K>]: V | null }
              : NestChain<V, K, Chain>
          : {}
export type MergeAll<
  M extends Mode,
  Items extends readonly unknown[],
  Acc = {}
> = Items extends readonly [infer H, ...infer Rest]
  ? MergeAll<M, Rest, Merge<Acc, Contribution<M, H>>>
  : Clean<Acc>
// --- object shapes (docs/shapes.md) ---
/** What an object-shape entry accepts: any value-carrying ref rooted
 * at the query's table. The object key is the alias. */
export type Selectable<Root = any> =
  | ColRef<any, any, any, Root>
  | ExprRef<any, Root>
  | AliasedRef<any, any, any, Root>
  | AggRef<any, any, Root>
type ShapeValue<R> =
  R extends ColRef<infer V, any, infer Chain, any>
    ? Chain extends readonly []
      ? V
      : V | null
    : R extends AliasedRef<infer V, any, any, any>
      ? V
      : R extends AggRef<infer V, any, any>
        ? V
        : R extends ExprRef<infer V, any>
          ? V
          : never
/** The result row of an object shape: one field per entry, keyed by
 * the object key. */
export type ShapeRow<S> = Clean<{
  -readonly [K in keyof S]: ShapeValue<S[K]>
}>
