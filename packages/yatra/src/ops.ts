import {
  accessor,
  dataOf,
  lit,
  mk,
  needData,
  type Accessor,
  type AggData,
  type AggRef,
  type AliasData,
  type AliasedRef,
  type ChainLink,
  type CheckItems,
  type ColRef,
  type CorePredOp,
  type ExprRef,
  type MergeAll,
  type NodeData,
  type OrderData,
  type OrderRef,
  type PredRef,
  type RelData,
  type RelRef,
  type RequireTuple,
  type RootOf,
  type Selectable,
  type ShapeRow
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
 * duplication. `where(t => exists(t.books, b => gt(b.price, 10)))`
 * returns each matching author once, however many books match.
 */
export function exists<
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
// --- aggregate functions (docs/shapes.md) ---
// Free-standing aggregates over the statement's groups — ordinary
// expr ops; the facets live in the coreAggFns pack. Legal wherever
// group keys are: a bare `select(t => ({ n: count() }))` counts the
// whole table as one group.
const aggFn = <V, Root>(
  op: string,
  args: readonly NodeData[]
): ExprRef<V, Root> => mk({ kind: "expr", op, args })
export function sum<
  R extends
    | ColRef<number | null, any, any>
    | ExprRef<number | null, any>
>(ref: R): ExprRef<number | null, RootOf<R>> {
  return aggFn("sum", [needData(ref)])
}
export function avg<
  R extends
    | ColRef<number | null, any, any>
    | ExprRef<number | null, any>
>(ref: R): ExprRef<number | null, RootOf<R>> {
  return aggFn("avg", [needData(ref)])
}
export function min<
  R extends
    | ColRef<number | null, any, any>
    | ExprRef<number | null, any>
>(ref: R): ExprRef<number | null, RootOf<R>> {
  return aggFn("min", [needData(ref)])
}
export function max<
  R extends
    | ColRef<number | null, any, any>
    | ExprRef<number | null, any>
>(ref: R): ExprRef<number | null, RootOf<R>> {
  return aggFn("max", [needData(ref)])
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
/** Count rows in the group: `select(t => ({ n: count() }))` counts
 * the whole table as one group; with `group(...)` it counts per
 * group. Over a relation it counts related rows. */
export function count(): ExprRef<number, any>
export function count<
  D extends Tableish,
  K extends string,
  Root
>(rel: RelRef<D, K, Root>): AggRef<number, K, Root>
export function count(rel?: unknown): unknown {
  if (rel === undefined) {
    return aggFn("count", [])
  }
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
// --- object shapes (docs/shapes.md) ---
/** The inherent result key of a node, if it has one. */
function inherentKey(d: NodeData): string | undefined {
  switch (d.kind) {
    case "col":
      return d.key
    case "as":
      return d.alias
    case "agg":
      return d.key
    default:
      return undefined
  }
}
/**
 * Desugar an object shape to selection nodes: the key is the alias.
 * Entries whose node already produces that key pass through; the rest
 * get an `as` wrapper.
 */
export function shapeItems(
  shape: Record<string, unknown>
): NodeData[] {
  return Object.entries(shape).map(([k, v]) => {
    const d = dataOf(v)
    if (!d) {
      throw new Error(
        `Shape entry '${k}' is not a yatra node`
      )
    }
    if (inherentKey(d) === k) return d
    const aliased: AliasData = {
      kind: "as",
      target: d,
      alias: k
    }
    return aliased
  })
}
/** A shape callback's result: an object (key = alias) or the low-level
 * tuple form. */
type ShapeOut = Record<string, unknown> | readonly unknown[]
/** Filter/order/limit a sub-shape: "each author with their 5 cheapest
 * books" stays inside the shape language. */
export interface SubShapeOpts<D extends Tableish, Root> {
  readonly where?: (
    t: Accessor<D, readonly [], Root>
  ) => PredRef<Root> | readonly PredRef<Root>[]
  readonly orderBy?: (
    t: Accessor<D, readonly [], Root>
  ) => OrderRef<Root> | readonly OrderRef<Root>[]
  readonly limit?: number
}
function aggSub(
  aggKind: "array" | "one",
  rel: unknown,
  fn: (t: any) => ShapeOut,
  opts?: SubShapeOpts<any, any>
): unknown {
  const d = dataOf(rel) as RelData
  const sub = accessor(d.relation.destinationTable)
  const out = fn(sub)
  const items = Array.isArray(out)
    ? (out as readonly unknown[]).map(needData)
    : shapeItems(out as Record<string, unknown>)
  const w = opts?.where?.(sub)
  const o = opts?.orderBy?.(sub)
  const data: AggData = {
    kind: "agg",
    aggKind,
    relation: d.relation,
    key: d.key,
    items,
    ...(w
      ? {
          where: (Array.isArray(w) ? w : [w]).map(needData)
        }
      : {}),
    ...(o
      ? {
          order: (Array.isArray(o) ? o : [o]).map(
            x => needData(x) as OrderData
          )
        }
      : {}),
    ...(opts?.limit !== undefined
      ? { limit: lit(opts.limit) }
      : {})
  }
  return mk(data)
}
/** A nested collection in an object shape: `books: many(t.books, b =>
 * ({ title: b.title }))`. Subsumes jsonAgg. */
export function many<
  D extends Tableish,
  K extends string,
  Root,
  const Items extends readonly unknown[]
>(
  rel: RelRef<D, K, Root>,
  fn: (
    t: Accessor<D, readonly [], Root>
  ) => CheckItems<Items, Root> & RequireTuple<Items>,
  opts?: SubShapeOpts<D, Root>
): AggRef<MergeAll<"hydrate", Items>[], K, Root>
export function many<
  D extends Tableish,
  K extends string,
  Root,
  const S extends Record<string, Selectable<Root>>
>(
  rel: RelRef<D, K, Root>,
  fn: (t: Accessor<D, readonly [], Root>) => S,
  opts?: SubShapeOpts<D, Root>
): AggRef<ShapeRow<S>[], K, Root>
export function many(
  rel: unknown,
  fn: (t: any) => ShapeOut,
  opts?: SubShapeOpts<any, any>
): unknown {
  return aggSub("array", rel, fn, opts)
}
/** A nested to-one in an object shape: null when the relation misses. */
export function one<
  D extends Tableish,
  K extends string,
  Root,
  const Items extends readonly unknown[]
>(
  rel: RelRef<D, K, Root>,
  fn: (
    t: Accessor<D, readonly [], Root>
  ) => CheckItems<Items, Root> & RequireTuple<Items>,
  opts?: SubShapeOpts<D, Root>
): AggRef<MergeAll<"hydrate", Items> | null, K, Root>
export function one<
  D extends Tableish,
  K extends string,
  Root,
  const S extends Record<string, Selectable<Root>>
>(
  rel: RelRef<D, K, Root>,
  fn: (t: Accessor<D, readonly [], Root>) => S,
  opts?: SubShapeOpts<D, Root>
): AggRef<ShapeRow<S> | null, K, Root>
export function one(
  rel: unknown,
  fn: (t: any) => ShapeOut,
  opts?: SubShapeOpts<any, any>
): unknown {
  return aggSub("one", rel, fn, opts)
}
