import {
  accessor,
  dataOf,
  mk,
  needData,
  type Accessor,
  type AggData,
  type AggRef,
  type AliasedRef,
  type ChainLink,
  type CheckItems,
  type ColRef,
  type ExprRef,
  type MergeAll,
  type OrderRef,
  type PredOp,
  type PredRef,
  type RelData,
  type RelRef,
  type RootOf
} from "./ref.ts"
import type { Tableish } from "./utils.ts"
type ColValue<R> =
  R extends ColRef<infer V, any, any> ? V : never
// --- aliasing ---
export function as<
  V,
  A extends string,
  Chain extends readonly ChainLink[],
  Root
>(
  ref: ColRef<V, string, Chain, Root>,
  alias: A
): AliasedRef<V, A, Chain, Root>
export function as<V, A extends string, Root>(
  ref: ExprRef<V, Root>,
  alias: A
): AliasedRef<V, A, readonly [], Root>
export function as<
  V,
  K extends string,
  A extends string,
  Root
>(ref: AggRef<V, K, Root>, alias: A): AggRef<V, A, Root>
export function as(ref: unknown, alias: string): unknown {
  return mk({ kind: "as", target: needData(ref), alias })
}
// --- expressions ---
export function lower<V extends string | null, Root>(
  ref: ColRef<V, any, any, Root>
): ExprRef<V, Root> {
  return mk({
    kind: "expr",
    op: "lower",
    args: [dataOf(ref)]
  })
}
export function mul<V extends number | null, Root>(
  ref: ColRef<V, any, any, Root>,
  n: number
): ExprRef<V, Root> {
  return mk({
    kind: "expr",
    op: "mul",
    args: [dataOf(ref), n]
  })
}
// --- predicates ---
const pred = <Root>(
  op: PredOp,
  args: readonly unknown[]
): PredRef<Root> => mk({ kind: "pred", op, args })
export function eq<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef<RootOf<R>> {
  return pred("eq", [ref, value])
}
export function ne<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef<RootOf<R>> {
  return pred("ne", [ref, value])
}
export function gt<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef<RootOf<R>> {
  return pred("gt", [ref, value])
}
export function gte<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef<RootOf<R>> {
  return pred("gte", [ref, value])
}
export function lt<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef<RootOf<R>> {
  return pred("lt", [ref, value])
}
export function lte<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef<RootOf<R>> {
  return pred("lte", [ref, value])
}
export function like<
  R extends ColRef<string | null, any, any>
>(ref: R, pattern: string): PredRef<RootOf<R>> {
  return pred("like", [ref, pattern])
}
export function ilike<
  R extends ColRef<string | null, any, any>
>(ref: R, pattern: string): PredRef<RootOf<R>> {
  return pred("ilike", [ref, pattern])
}
export function inArray<R extends ColRef<any, any, any>>(
  ref: R,
  values: readonly NonNullable<ColValue<R>>[]
): PredRef<RootOf<R>> {
  return pred("in", [ref, values])
}
export function isNull<R extends ColRef<any, any, any>>(
  ref: R
): PredRef<RootOf<R>> {
  return pred("isNull", [ref])
}
export function isNotNull<R extends ColRef<any, any, any>>(
  ref: R
): PredRef<RootOf<R>> {
  return pred("isNotNull", [ref])
}
type PredRoots<P extends readonly unknown[]> =
  P extends readonly [infer H, ...infer Rest]
    ? RootOf<H> | PredRoots<Rest>
    : never
export function and<P extends readonly PredRef<any>[]>(
  ...preds: P
): PredRef<PredRoots<P>> {
  return pred("and", preds)
}
export function or<P extends readonly PredRef<any>[]>(
  ...preds: P
): PredRef<PredRoots<P>> {
  return pred("or", preds)
}
export function not<P extends PredRef<any>>(
  p: P
): PredRef<RootOf<P>> {
  return pred("not", [p])
}
// --- ordering ---
export function asc<R extends ColRef<any, any, any>>(
  ref: R
): OrderRef<RootOf<R>> {
  return mk({
    kind: "order",
    direction: "asc",
    ref: needData(ref)
  })
}
export function desc<R extends ColRef<any, any, any>>(
  ref: R
): OrderRef<RootOf<R>> {
  return mk({
    kind: "order",
    direction: "desc",
    ref: needData(ref)
  })
}
// --- aggregations ---
export function jsonAgg<
  D extends Tableish,
  K extends string,
  Root,
  const Items extends readonly unknown[]
>(
  rel: RelRef<D, K, Root>,
  fn: (
    t: Accessor<D, readonly [], Root>
  ) => CheckItems<Items, Root>
): AggRef<MergeAll<"hydrate", Items>[], K, Root> {
  const d = dataOf(rel) as RelData
  const items = fn(
    accessor(d.relation.destinationTable) as Accessor<
      D,
      readonly [],
      Root
    >
  )
  const data: AggData = {
    kind: "agg",
    aggKind: "array",
    relation: d.relation,
    key: d.key,
    items
  }
  return mk(data)
}
export function count<
  D extends Tableish,
  K extends string,
  Root
>(rel: RelRef<D, K, Root>): AggRef<number, K, Root> {
  const d = dataOf(rel) as RelData
  const data: AggData = {
    kind: "agg",
    aggKind: "count",
    relation: d.relation,
    key: d.key,
    items: []
  }
  return mk(data)
}
