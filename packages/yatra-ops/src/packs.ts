import {
  litBound,
  projectionOf,
  type EvalCtx,
  type LitData,
  type NodeData,
  type OpPack,
  type RelData,
  type SqlCtx
} from "yatra"

// The built-in vocabulary as op packs: every op is a pair of facets,
// `sql` (emit text) and `eval` (in-memory value), sharing SQL-92
// semantics — three-valued null logic, nulls sort last. Backends
// assemble these; user packs compose the same way.

type Cmp = ">" | ">=" | "<" | "<="

const sqlCmp =
  (op: string) => (args: readonly NodeData[], c: SqlCtx) =>
    `${c.value(args[0])} ${op} ${c.value(args[1])}`

const evalCmp =
  (op: Cmp) => (args: readonly NodeData[], c: EvalCtx) => {
    const x = c.value(args[0]) as any
    const y = c.value(args[1]) as any
    if (x == null || y == null) return null
    switch (op) {
      case ">":
        return x > y
      case ">=":
        return x >= y
      case "<":
        return x < y
      case "<=":
        return x <= y
    }
  }

function likeRegex(pattern: string, ci: boolean): RegExp {
  const re = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".")
  return new RegExp(`^${re}$`, ci ? "i" : "")
}

const evalLike =
  (ci: boolean) =>
  (args: readonly NodeData[], c: EvalCtx) => {
    const x = c.value(args[0])
    const y = c.value(args[1])
    if (x == null || y == null) return null
    return likeRegex(String(y), ci).test(String(x))
  }

export const corePred: OpPack = {
  name: "core/pred",
  pred: {
    eq: {
      sql: sqlCmp("="),
      eval: (a, c) => {
        const x = c.value(a[0])
        const y = c.value(a[1])
        return x == null || y == null ? null : x === y
      }
    },
    ne: {
      sql: sqlCmp("<>"),
      eval: (a, c) => {
        const x = c.value(a[0])
        const y = c.value(a[1])
        return x == null || y == null ? null : x !== y
      }
    },
    gt: { sql: sqlCmp(">"), eval: evalCmp(">") },
    gte: { sql: sqlCmp(">="), eval: evalCmp(">=") },
    lt: { sql: sqlCmp("<"), eval: evalCmp("<") },
    lte: { sql: sqlCmp("<="), eval: evalCmp("<=") },
    like: { sql: sqlCmp("LIKE"), eval: evalLike(false) },
    in: {
      sql: (a, c) =>
        `${c.value(a[0])} = ANY(${c.param((a[1] as LitData).value)})`,
      eval: (a, c) => {
        const x = c.value(a[0])
        if (x == null) return null
        const values = (a[1] as LitData)
          .value as readonly unknown[]
        return values.some(v => v === x)
      }
    },
    isNull: {
      sql: (a, c) => `${c.value(a[0])} IS NULL`,
      eval: (a, c) => c.value(a[0]) == null
    },
    isNotNull: {
      sql: (a, c) => `${c.value(a[0])} IS NOT NULL`,
      eval: (a, c) => c.value(a[0]) != null
    },
    and: {
      sql: (a, c) =>
        `(${a.map(x => c.pred(x)).join(" AND ")})`,
      eval: (a, c) => {
        let sawNull = false
        for (const x of a) {
          const v = c.pred(x)
          if (v === false) return false
          if (v === null) sawNull = true
        }
        return sawNull ? null : true
      }
    },
    or: {
      sql: (a, c) =>
        `(${a.map(x => c.pred(x)).join(" OR ")})`,
      eval: (a, c) => {
        let sawNull = false
        for (const x of a) {
          const v = c.pred(x)
          if (v === true) return true
          if (v === null) sawNull = true
        }
        return sawNull ? null : false
      }
    },
    not: {
      sql: (a, c) => `NOT (${c.pred(a[0])})`,
      eval: (a, c) => {
        const v = c.pred(a[0])
        return v === null ? null : !v
      }
    },
    exists: {
      // scope-creating: the relation is the subquery's FROM, not a
      // join in the enclosing scope (see plan.ts collectChains)
      sql: (a, c) => {
        const rel = a[0] as RelData
        const preds = a.slice(1)
        const s = c.scope(
          rel.relation,
          rel.key,
          rel.chain.slice(0, -1),
          preds
        )
        const conds = [
          s.correlation,
          ...preds.map(x => s.pred(x))
        ]
        return `EXISTS (SELECT 1 FROM ${s.from} WHERE ${conds.join(" AND ")})`
      },
      eval: (a, c) => {
        const rel = a[0] as RelData
        const s = c.scope(
          rel.relation,
          rel.chain.slice(0, -1)
        )
        let matches = s.matches()
        for (const sp of a.slice(1)) {
          matches = matches.filter(
            m => s.pred(m, sp) === true
          )
        }
        return matches.length > 0
      }
    }
  }
}

export const coreExpr: OpPack = {
  name: "core/expr",
  expr: {
    lower: {
      sql: (a, c) => `lower(${c.value(a[0])})`,
      eval: (a, c) => {
        const v = c.value(a[0])
        return v == null ? null : String(v).toLowerCase()
      }
    },
    mul: {
      sql: (a, c) =>
        `(${c.value(a[0])} * ${c.value(a[1])})`,
      eval: (a, c) => {
        const x = c.value(a[0])
        const y = c.value(a[1])
        return x == null || y == null
          ? null
          : Number(x) * Number(y)
      }
    }
  }
}

export const coreAgg: OpPack = {
  name: "core/agg",
  agg: {
    count: {
      sql: (spec, c) => {
        const s = c.scope(spec.relation, spec.key, [], [])
        return `(SELECT count(*)::int FROM ${s.from} WHERE ${s.correlation})`
      },
      eval: (spec, c) =>
        c.scope(spec.relation, []).matches().length
    },
    array: {
      // the core builder is many(); the SQL spelling (jsonb_agg) is
      // this facet's business, not the IR's. Without an explicit
      // orderBy the collection is DISTINCT and ordered by the object
      // itself (jsonb ordering) — deterministic, so every backend
      // agrees on the result.
      sql: (spec, c) => {
        const s = c.scope(
          spec.relation,
          spec.key,
          [],
          [
            ...spec.items,
            ...(spec.where ?? []),
            ...(spec.order ?? [])
          ]
        )
        const proj = projectionOf(spec.items, "hydrate")
        const pairs = spec.items
          .flatMap((item, i) => [
            `'${proj[i].col.replaceAll("'", "''")}'`,
            s.value(item)
          ])
          .join(", ")
        const obj = `jsonb_build_object(${pairs})`
        const conds = [
          s.correlation,
          ...(spec.where ?? []).map(w => s.pred(w))
        ].join(" AND ")
        const orders = (spec.order ?? []).map(
          o =>
            `${s.value(o.ref)} ${o.direction.toUpperCase()}`
        )
        const limitN = litBound(spec.limit, "limit")
        if (limitN !== undefined) {
          // order + limit need their own level between build_object
          // and the aggregate
          const inner =
            orders.length > 0
              ? `SELECT ${obj} AS obj FROM ${s.from} WHERE ${conds} ORDER BY ${orders.join(", ")} LIMIT ${c.param(limitN)}`
              : `SELECT DISTINCT ${obj} AS obj FROM ${s.from} WHERE ${conds} ORDER BY obj LIMIT ${c.param(limitN)}`
          return `coalesce((SELECT jsonb_agg(obj) FROM (${inner}) ${s.name}_l), '[]'::jsonb)`
        }
        if (orders.length > 0) {
          // DISTINCT can't combine with ORDER BY in an aggregate
          return (
            `coalesce((SELECT jsonb_agg(${obj} ORDER BY ${orders.join(", ")})` +
            ` FROM ${s.from} WHERE ${conds}), '[]'::jsonb)`
          )
        }
        return (
          `coalesce((SELECT jsonb_agg(DISTINCT ${obj} ORDER BY ${obj})` +
          ` FROM ${s.from} WHERE ${conds}), '[]'::jsonb)`
        )
      },
      eval: (spec, c) =>
        c.scope(spec.relation, []).collect(spec)
    },
    one: {
      sql: (spec, c) => {
        const s = c.scope(
          spec.relation,
          spec.key,
          [],
          [
            ...spec.items,
            ...(spec.where ?? []),
            ...(spec.order ?? [])
          ]
        )
        const proj = projectionOf(spec.items, "hydrate")
        const pairs = spec.items
          .flatMap((item, i) => [
            `'${proj[i].col.replaceAll("'", "''")}'`,
            s.value(item)
          ])
          .join(", ")
        const obj = `jsonb_build_object(${pairs})`
        const conds = [
          s.correlation,
          ...(spec.where ?? []).map(w => s.pred(w))
        ].join(" AND ")
        const orders = (spec.order ?? []).map(
          o =>
            `${s.value(o.ref)} ${o.direction.toUpperCase()}`
        )
        // no explicit order: deterministic pick (jsonb ordering)
        const orderBy =
          orders.length > 0 ? orders.join(", ") : obj
        return (
          `(SELECT ${obj} FROM ${s.from} WHERE ${conds}` +
          ` ORDER BY ${orderBy} LIMIT 1)`
        )
      },
      eval: (spec, c) =>
        c.scope(spec.relation, []).collect({
          ...spec,
          limit: { kind: "lit", value: 1 }
        })[0] ?? null
    }
  }
}

/** Postgres text ops. Both facets ship so the memory backend matches
 * Postgres exactly — dialect deviations live in packs, not interpreters. */
export const pgText: OpPack = {
  name: "pg/text",
  pred: {
    ilike: { sql: sqlCmp("ILIKE"), eval: evalLike(true) }
  }
}

// --- free-standing aggregates (docs/shapes.md) ---
// Aggregate functions over the statement's groups: ordinary expr ops
// marked `aggregate`, legal wherever group keys are.
function groupOf(c: EvalCtx): readonly EvalCtx[] {
  const g = c.group?.()
  if (!g) {
    throw new Error(
      "aggregate functions need a grouped statement or a bare aggregate select"
    )
  }
  return g
}
/** reduce the group's non-null values; empty/all-null is null (SQL) */
function reduceNums(
  c: EvalCtx,
  arg: NodeData,
  f: (acc: number, v: number) => number
): number | null {
  let acc: number | null = null
  for (const t of groupOf(c)) {
    const v = t.value(arg)
    if (v != null) {
      acc = acc === null ? Number(v) : f(acc, Number(v))
    }
  }
  return acc
}
export const coreAggFns: OpPack = {
  name: "core/agg-fns",
  expr: {
    count: {
      aggregate: true,
      sql: (a, c) =>
        a.length === 0
          ? "count(*)::int"
          : `count(${c.value(a[0])})::int`,
      eval: (a, c) =>
        a.length === 0
          ? groupOf(c).length
          : groupOf(c).filter(t => t.value(a[0]) != null)
              .length
    },
    sum: {
      aggregate: true,
      sql: (a, c) => `sum(${c.value(a[0])})`,
      eval: (a, c) =>
        reduceNums(c, a[0], (acc, v) => acc + v)
    },
    avg: {
      aggregate: true,
      sql: (a, c) => `avg(${c.value(a[0])})`,
      eval: (a, c) => {
        let n = 0
        let acc = 0
        for (const t of groupOf(c)) {
          const v = t.value(a[0])
          if (v != null) {
            n++
            acc += Number(v)
          }
        }
        return n === 0 ? null : acc / n
      }
    },
    min: {
      aggregate: true,
      sql: (a, c) => `min(${c.value(a[0])})`,
      eval: (a, c) =>
        reduceNums(c, a[0], (acc, v) => Math.min(acc, v))
    },
    max: {
      aggregate: true,
      sql: (a, c) => `max(${c.value(a[0])})`,
      eval: (a, c) =>
        reduceNums(c, a[0], (acc, v) => Math.max(acc, v))
    }
  }
}

/** The standard assembly `postgres` and yatra-memory are built from. */
export const defaultPacks: readonly OpPack[] = [
  corePred,
  coreExpr,
  coreAgg,
  coreAggFns,
  pgText
]
