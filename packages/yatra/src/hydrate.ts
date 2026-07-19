import { flatAlias } from "./compile.ts"
import { dataOf } from "./ref.ts"
import { info } from "./table.ts"
import type { Tableish } from "./utils.ts"
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
function buildTree(
  table: Tableish,
  items: readonly unknown[]
): SelTree {
  const root = emptyTree()
  for (const item of items) {
    const data = dataOf(item)
    if (!data) continue
    if (data.kind === "as") {
      root.fields.push({
        outKey: data.alias,
        col: data.alias
      })
      continue
    }
    if (data.kind === "agg") {
      root.fields.push({ outKey: data.key, col: data.key })
      continue
    }
    if (data.kind !== "col") continue
    let tree = root
    let current = table
    for (const seg of data.chain) {
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
      outKey: data.key,
      col:
        data.chain.length > 0
          ? flatAlias([...data.chain, data.key].join("."))
          : data.key
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
  ctx: QueryContext<T, "hydrate", Items>,
  rows: readonly Record<string, unknown>[]
): Result<QueryContext<T, "hydrate", Items>> {
  const tree = buildTree(ctx.table, ctx.selection)
  return group(tree, rows) as Result<
    QueryContext<T, "hydrate", Items>
  >
}
