import { info } from "./table.ts"
import type { Tableish } from "./utils.ts"
import type { ProjectionField } from "./plan.ts"
import type { QueryContext, Result } from "./query.ts"
interface FieldSpec {
  outKey: string
  col: string
}
interface SelTree {
  fields: FieldSpec[]
  children: Array<{
    name: string
    toMany: boolean
    tree: SelTree
  }>
}
const emptyTree = (): SelTree => ({
  fields: [],
  children: []
})
// The nesting tree comes from the projection descriptor the emitter
// produced — hydrate decodes what was emitted, it never re-derives
// result column names.
function buildTree(
  table: Tableish,
  projection: readonly ProjectionField[]
): SelTree {
  const root = emptyTree()
  for (const field of projection) {
    let tree = root
    let current = table
    for (const seg of field.chain) {
      let child = tree.children.find(c => c.name === seg)
      if (!child) {
        const relation = info(current).relations[seg]
        const toMany =
          relation?.type === "one-to-many" ||
          relation?.type === "many-to-many"
        child = { name: seg, toMany, tree: emptyTree() }
        tree.children.push(child)
        current = relation.destinationTable
      } else {
        current =
          info(current).relations[seg].destinationTable
      }
      tree = child.tree
    }
    tree.fields.push({
      outKey: field.outKey,
      col: field.col
    })
  }
  return root
}
function group(
  tree: SelTree,
  rows: readonly Record<string, unknown>[]
): Record<string, unknown>[] {
  const groups = new Map<
    string,
    {
      obj: Record<string, unknown>
      rows: Record<string, unknown>[]
    }
  >()
  for (const row of rows) {
    const vals = tree.fields.map(f => row[f.col])
    if (
      tree.fields.length > 0 &&
      vals.every(v => v == null)
    )
      continue
    const key = JSON.stringify(vals)
    let g = groups.get(key)
    if (!g) {
      const obj: Record<string, unknown> = {}
      tree.fields.forEach((f, i) => {
        obj[f.outKey] = vals[i]
      })
      g = { obj, rows: [] }
      groups.set(key, g)
    }
    g.rows.push(row)
  }
  const out: Record<string, unknown>[] = []
  for (const { obj, rows: groupRows } of groups.values()) {
    for (const child of tree.children) {
      const nested = group(child.tree, groupRows)
      obj[child.name] = child.toMany
        ? nested
        : (nested[0] ?? null)
    }
    out.push(obj)
  }
  return out
}
export function hydrateRows<
  T extends Tableish,
  Items extends readonly unknown[]
>(
  table: T,
  rows: readonly Record<string, unknown>[],
  projection: readonly ProjectionField[]
): Result<QueryContext<T, "hydrate", Items>> {
  if (projection.length === 0) {
    // SELECT t.* with no joins: rows are already the full row shape
    return rows as unknown as Result<
      QueryContext<T, "hydrate", Items>
    >
  }
  const tree = buildTree(table, projection)
  return group(tree, rows) as Result<
    QueryContext<T, "hydrate", Items>
  >
}
