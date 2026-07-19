import { toSQL } from "./compile.ts"
import { hydrateRows } from "./hydrate.ts"
import type { QueryContext, Result, Row } from "./query.ts"
import type { Mode } from "./ref.ts"
import type { Tableish } from "./utils.ts"
export interface Executor {
  query(
    sql: string,
    params: readonly unknown[]
  ): Promise<readonly Record<string, unknown>[]>
}
export function run<E extends Executor>(exec: E) {
  return async <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[]
  >(
    ctx: QueryContext<T, M, Items>
  ): Promise<Result<QueryContext<T, M, Items>>> => {
    const { sql, params } = toSQL(ctx)
    const rows = await exec.query(sql, params)
    if (ctx.mode === "hydrate") {
      return hydrateRows(
        ctx as QueryContext<T, "hydrate", Items>,
        rows
      ) as Result<QueryContext<T, M, Items>>
    }
    return rows as Result<QueryContext<T, M, Items>>
  }
}
export function runOne<E extends Executor>(exec: E) {
  return async <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[]
  >(
    ctx: QueryContext<T, M, Items>
  ): Promise<Row<QueryContext<T, M, Items>> | null> => {
    const rows = await run(exec)(ctx)
    return rows[0] ?? null
  }
}
