import { postgres, type Compiler } from "./compile.ts"
import { hydrateRows } from "./hydrate.ts"
import { type QueryContext, type Row } from "./query.ts"
import type { MergeAll, Mode } from "./ref.ts"
import type { StatementKind } from "./statement.ts"
import type { Tableish } from "./utils.ts"
export interface Executor {
  query(
    sql: string,
    params: readonly unknown[]
  ): Promise<readonly Record<string, unknown>[]>
}
export type StatementResult<C> =
  C extends QueryContext<any, any, infer Items, infer K>
    ? K extends "select"
      ? Row<C>[]
      : Items extends readonly []
        ? void
        : MergeAll<"flat", Items>[]
    : never
/**
 * Terminal pipe step. The backend is explicit: pass a `Compiler`
 * to target anything but postgres (`run(exec, myCompiler)`).
 */
export function run<E extends Executor>(
  exec: E,
  compiler: Compiler = postgres
) {
  return (async (ctx: QueryContext<any, any, any, any>) => {
    const { sql, params, projection } =
      compiler.compile(ctx)
    const rows = await exec.query(sql, params)
    if (ctx.kind !== "select") {
      return ctx.selection.length > 0 ? rows : undefined
    }
    if (ctx.mode === "hydrate") {
      return hydrateRows(ctx.source.table, rows, projection)
    }
    return rows
  }) as <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[],
    K extends StatementKind
  >(
    ctx: QueryContext<T, M, Items, K>
  ) => Promise<
    StatementResult<QueryContext<T, M, Items, K>>
  >
}
export function runOne<E extends Executor>(
  exec: E,
  compiler: Compiler = postgres
) {
  return async <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[]
  >(
    ctx: QueryContext<T, M, Items, "select">
  ): Promise<Row<
    QueryContext<T, M, Items, "select">
  > | null> => {
    const rows = (await run(
      exec,
      compiler
    )(ctx)) as unknown as Row<
      QueryContext<T, M, Items, "select">
    >[]
    return rows[0] ?? null
  }
}
