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
export type PredOp =
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
export interface ExprData {
  readonly kind: "expr"
  readonly op: string
  readonly args: readonly unknown[]
}
export interface AliasData {
  readonly kind: "as"
  readonly target: NodeData
  readonly alias: string
}
export interface AggData {
  readonly kind: "agg"
  readonly aggKind: "array" | "count"
  readonly relation: Relation<any, any>
  readonly key: string
  readonly items: readonly unknown[]
}
export interface PredData {
  readonly kind: "pred"
  readonly op: PredOp
  readonly args: readonly unknown[]
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
  | ExprData
  | AliasData
  | AggData
  | PredData
  | OrderData
  | RelData
// --- type-level node brands ---
export interface ColRef<
  V = any,
  Key extends string = string,
  Chain extends readonly ChainLink[] = readonly ChainLink[]
> {
  readonly [RefData]: {
    readonly kind: "col"
    readonly value: V
    readonly key: Key
    readonly chain: Chain
  }
}
export interface ExprRef<V = any> {
  readonly [RefData]: {
    readonly kind: "expr"
    readonly value: V
  }
}
export interface AliasedRef<
  V = any,
  Alias extends string = string,
  Chain extends readonly ChainLink[] = readonly ChainLink[]
> {
  readonly [RefData]: {
    readonly kind: "as"
    readonly value: V
    readonly alias: Alias
    readonly chain: Chain
  }
}
export interface AggRef<
  V = any,
  Key extends string = string
> {
  readonly [RefData]: {
    readonly kind: "agg"
    readonly value: V
    readonly key: Key
  }
}
export interface RelRef<
  D extends Tableish = Tableish,
  Key extends string = string
> {
  readonly [RefData]: {
    readonly kind: "rel"
    readonly dest: D
    readonly key: Key
  }
}
export interface PredRef {
  readonly [RefData]: {
    readonly kind: "pred"
  }
}
export interface OrderRef {
  readonly [RefData]: {
    readonly kind: "order"
    readonly direction: "asc" | "desc"
  }
}
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
// --- accessor ---
type FieldsOf<T extends Tableish> = TableishFields<T>
type RelsOf<T extends Tableish> = TableRelations<T>
type RelAccess<
  R,
  K extends string,
  Chain extends readonly ChainLink[]
> =
  R extends Relation<any, infer D>
    ? D extends Tableish
      ? R["type"] extends infer RT extends RelationType
        ? Accessor<
            D,
            readonly [
              ...Chain,
              { readonly name: K; readonly rel: RT }
            ]
          > &
            RelRef<D, K>
        : never
      : never
    : never
export type Accessor<
  T extends Tableish,
  Chain extends readonly ChainLink[] = readonly []
> = {
  readonly [K in keyof FieldsOf<T> & string]: ColRef<
    InferColumn<FieldsOf<T>[K]>,
    K,
    Chain
  >
} & {
  readonly [K in keyof RelsOf<T> & string]: RelAccess<
    RelsOf<T>[K],
    K,
    Chain
  >
}
export function accessor<T extends Tableish>(
  table: T,
  chain: readonly string[] = []
): Accessor<T> {
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
  ) as Accessor<T>
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
export type CheckItem<Item> = Item extends
  | ColRef<any, any, any>
  | AliasedRef<any, any, any>
  | AggRef<any, any>
  ? Item
  : Item extends ExprRef<any>
    ? "Expressions need an alias: as(expr, 'name')"
    : "Selection items must be a column ref (t.id), an aliased expression as(expr, 'name'), or an aggregation jsonAgg(t.rel, ...)/count(t.rel) — a bare relation is not selectable"
type Conform<T, Base> = T extends Base ? T : Base
export type CheckItems<Items extends readonly unknown[]> = {
  [K in keyof Items]: Conform<
    Items[K],
    CheckItem<NoInfer<Items[K]>>
  >
}
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
  Item extends AggRef<infer V, infer K>
    ? { [Key in K]: V }
    : Item extends AliasedRef<infer V, infer A, infer Chain>
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
