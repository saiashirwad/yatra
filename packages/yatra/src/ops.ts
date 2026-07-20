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
  type RelRef
} from "./ref.ts"
import type { Tableish } from "./utils.ts"
type ColValue<R> =
  R extends ColRef<infer V, any, any> ? V : never
// --- aliasing ---
export function as<
  V,
  A extends string,
  Chain extends readonly ChainLink[]
>(
  ref: ColRef<V, string, Chain>,
  alias: A
): AliasedRef<V, A, Chain>
export function as<V, A extends string>(
  ref: ExprRef<V>,
  alias: A
): AliasedRef<V, A, readonly []>
export function as<V, K extends string, A extends string>(
  ref: AggRef<V, K>,
  alias: A
): AggRef<V, A>
export function as(ref: unknown, alias: string): unknown {
  return mk({ kind: "as", target: needData(ref), alias })
}
// --- expressions ---
export function lower<V extends string | null>(
  ref: ColRef<V, any, any>
): ExprRef<V> {
  return mk({
    kind: "expr",
    op: "lower",
    args: [dataOf(ref)]
  })
}
export function mul<V extends number | null>(
  ref: ColRef<V, any, any>,
  n: number
): ExprRef<V> {
  return mk({
    kind: "expr",
    op: "mul",
    args: [dataOf(ref), n]
  })
}
// --- predicates ---
const pred = (
  op: PredOp,
  args: readonly unknown[]
): PredRef => mk({ kind: "pred", op, args })
export function eq<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef {
  return pred("eq", [ref, value])
}
export function ne<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef {
  return pred("ne", [ref, value])
}
export function gt<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef {
  return pred("gt", [ref, value])
}
export function gte<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef {
  return pred("gte", [ref, value])
}
export function lt<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef {
  return pred("lt", [ref, value])
}
export function lte<R extends ColRef<any, any, any>>(
  ref: R,
  value: NonNullable<ColValue<R>>
): PredRef {
  return pred("lte", [ref, value])
}
export function like<
  R extends ColRef<string | null, any, any>
>(ref: R, pattern: string): PredRef {
  return pred("like", [ref, pattern])
}
export function ilike<
  R extends ColRef<string | null, any, any>
>(ref: R, pattern: string): PredRef {
  return pred("ilike", [ref, pattern])
}
export function inArray<R extends ColRef<any, any, any>>(
  ref: R,
  values: readonly NonNullable<ColValue<R>>[]
): PredRef {
  return pred("in", [ref, values])
}
export function isNull(
  ref: ColRef<any, any, any>
): PredRef {
  return pred("isNull", [ref])
}
export function isNotNull(
  ref: ColRef<any, any, any>
): PredRef {
  return pred("isNotNull", [ref])
}
export function and(...preds: readonly PredRef[]): PredRef {
  return pred("and", preds)
}
export function or(...preds: readonly PredRef[]): PredRef {
  return pred("or", preds)
}
export function not(p: PredRef): PredRef {
  return pred("not", [p])
}
// --- ordering ---
export function asc(ref: ColRef<any, any, any>): OrderRef {
  return mk({
    kind: "order",
    direction: "asc",
    ref: needData(ref)
  })
}
export function desc(ref: ColRef<any, any, any>): OrderRef {
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
  const Items extends readonly unknown[]
>(
  rel: RelRef<D, K>,
  fn: (t: Accessor<D>) => CheckItems<Items>
): AggRef<MergeAll<"hydrate", Items>[], K> {
  const d = dataOf(rel) as RelData
  const items = fn(
    accessor(d.relation.destinationTable) as Accessor<D>
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
export function count<D extends Tableish, K extends string>(
  rel: RelRef<D, K>
): AggRef<number, K> {
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
