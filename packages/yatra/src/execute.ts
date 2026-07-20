import { postgres, type Compiler } from "./compile.ts"
import { hydrateRows } from "./hydrate.ts"
import type { AnyMutationExtra } from "./mutation.ts"
import {
  type NoMutation,
  type QueryContext,
  type Row
} from "./query.ts"
import type { MergeAll, Mode } from "./ref.ts"
import type { Tableish } from "./utils.ts"
export interface Executor {
  query(
    sql: string,
    params: readonly unknown[]
  ): Promise<readonly Record<string, unknown>[]>
}
export type StatementResult<C> =
  C extends QueryContext<any, any, infer Items, infer X>
    ? X extends AnyMutationExtra
      ? Items extends readonly []
        ? void
        : MergeAll<"flat", Items>[]
      : Row<C>[]
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
    if ("kind" in ctx) {
      return ctx.selection.length > 0 ? rows : undefined
    }
    if (ctx.mode === "hydrate") {
      return hydrateRows(
        ctx as QueryContext<any, "hydrate", any>,
        rows,
        projection
      )
    }
    return rows
  }) as <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[],
    X
  >(
    ctx: QueryContext<T, M, Items, X>
  ) => Promise<
    StatementResult<QueryContext<T, M, Items, X>>
  >
}
export function runOne<E extends Executor>(
  exec: E,
  compiler: Compiler = postgres
) {
  return async <
    T extends Tableish,
    M extends Mode,
    Items extends readonly unknown[],
    X
  >(
    ctx: QueryContext<T, M, Items, X> &
      NoMutation<
        X,
        "runOne is only for queries — use run(exec) for mutations"
      >
  ): Promise<Row<QueryContext<T, M, Items, X>> | null> => {
    const rows = (await run(
      exec,
      compiler
    )(ctx)) as unknown as Row<
      QueryContext<T, M, Items, X>
    >[]
    return rows[0] ?? null
  }
}
