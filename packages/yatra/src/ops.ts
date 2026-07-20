import {
  accessor,
  dataOf,
  lit,
  mk,
  needData,
  type Accessor,
  type AggData,
  type AggRef,
  type AliasedRef,
  type ChainLink,
  type CheckItems,
  type ColRef,
  type CorePredOp,
  type ExprRef,
  type MergeAll,
  type NodeData,
  type OrderRef,
  type PredRef,
  type RelData,
  type RelRef,
  type RootOf
} from "./ref.ts"
import type { Tableish } from "./utils.ts"
type RefValue<R> =
  R extends ColRef<infer V, any, any>
    ? V
    : R extends ExprRef<infer V, any>
      ? V
      : never
/** Any ref that carries a value: a column or an expression. */
type AnyValueRef =
  | ColRef<any, any, any, any>
  | ExprRef<any, any>
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
    args: [needData(ref)]
  })
}
export function mul<V extends number | null, Root>(
  ref: ColRef<V, any, any, Root>,
  n: number
): ExprRef<V, Root> {
  return mk({
    kind: "expr",
    op: "mul",
    args: [needData(ref), lit(n)]
  })
}
// --- predicates ---
// Args are bare NodeData: refs are unwrapped, raw values become `lit`.
const pred = <Root>(
  op: CorePredOp,
  args: readonly NodeData[]
): PredRef<Root> => mk({ kind: "pred", op, args })
export function eq<R extends AnyValueRef>(
  ref: R,
  value: NonNullable<RefValue<R>>
): PredRef<RootOf<R>> {
  return pred("eq", [needData(ref), lit(value)])
}
export function ne<R extends AnyValueRef>(
  ref: R,
  value: NonNullable<RefValue<R>>
): PredRef<RootOf<R>> {
  return pred("ne", [needData(ref), lit(value)])
}
export function gt<R extends AnyValueRef>(
  ref: R,
  value: NonNullable<RefValue<R>>
): PredRef<RootOf<R>> {
  return pred("gt", [needData(ref), lit(value)])
}
export function gte<R extends AnyValueRef>(
  ref: R,
  value: NonNullable<RefValue<R>>
): PredRef<RootOf<R>> {
  return pred("gte", [needData(ref), lit(value)])
}
export function lt<R extends AnyValueRef>(
  ref: R,
  value: NonNullable<RefValue<R>>
): PredRef<RootOf<R>> {
  return pred("lt", [needData(ref), lit(value)])
}
export function lte<R extends AnyValueRef>(
  ref: R,
  value: NonNullable<RefValue<R>>
): PredRef<RootOf<R>> {
  return pred("lte", [needData(ref), lit(value)])
}
export function like<
  R extends
    | ColRef<string | null, any, any>
    | ExprRef<string | null, any>
>(ref: R, pattern: string): PredRef<RootOf<R>> {
  return pred("like", [needData(ref), lit(pattern)])
}
export function ilike<
  R extends
    | ColRef<string | null, any, any>
    | ExprRef<string | null, any>
>(ref: R, pattern: string): PredRef<RootOf<R>> {
  return pred("ilike", [needData(ref), lit(pattern)])
}
export function inArray<R extends AnyValueRef>(
  ref: R,
  values: readonly NonNullable<RefValue<R>>[]
): PredRef<RootOf<R>> {
  return pred("in", [needData(ref), lit(values)])
}
export function isNull<R extends AnyValueRef>(
  ref: R
): PredRef<RootOf<R>> {
  return pred("isNull", [needData(ref)])
}
export function isNotNull<R extends AnyValueRef>(
  ref: R
): PredRef<RootOf<R>> {
  return pred("isNotNull", [needData(ref)])
}
type PredRoots<P extends readonly unknown[]> =
  P extends readonly [infer H, ...infer Rest]
    ? RootOf<H> | PredRoots<Rest>
    : never
export function and<P extends readonly PredRef<any>[]>(
  ...preds: P
): PredRef<PredRoots<P>> {
  return pred("and", preds.map(needData))
}
export function or<P extends readonly PredRef<any>[]>(
  ...preds: P
): PredRef<PredRoots<P>> {
  return pred("or", preds.map(needData))
}
export function not<P extends PredRef<any>>(
  p: P
): PredRef<RootOf<P>> {
  return pred("not", [needData(p)])
}
// --- subqueries ---
/**
 * EXISTS subquery: filter parents by their children without join
 * duplication. `where(t => whereExists(t.books, b => gt(b.price, 10)))`
 * returns each matching author once, however many books match.
 */
export function whereExists<
  D extends Tableish,
  K extends string,
  Root
>(
  rel: RelRef<D, K, Root>,
  fn?: (
    t: Accessor<D, readonly [], Root>
  ) => PredRef<Root> | readonly PredRef<Root>[]
): PredRef<Root> {
  const d = dataOf(rel) as RelData
  const p = fn?.(
    accessor(d.relation.destinationTable) as Accessor<
      D,
      readonly [],
      Root
    >
  )
  const preds = p ? (Array.isArray(p) ? p : [p]) : []
  return pred("exists", [d, ...preds.map(needData)])
}
// --- ordering ---
export function asc<R extends AnyValueRef>(
  ref: R
): OrderRef<RootOf<R>> {
  return mk({
    kind: "order",
    direction: "asc",
    ref: needData(ref)
  })
}
export function desc<R extends AnyValueRef>(
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
    items: items.map(needData)
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
