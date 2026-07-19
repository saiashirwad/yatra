import { PgliteClient } from "@effect/sql-pglite"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlClient } from "effect/unstable/sql/SqlClient"
import {
  hydrateRows,
  toSQL,
  type Mode,
  type QueryContext,
  type Result,
  type Row,
  type Tableish
} from "yatra"
// --- errors ---
export class QueryError extends Schema.TaggedErrorClass<QueryError>()(
  "yatra/QueryError",
  {
    sql: Schema.String,
    cause: Schema.Unknown
  }
) {}
// --- service ---
export interface Interface {
  readonly query: (
    sql: string,
    params: readonly unknown[]
  ) => Effect.Effect<
    readonly Record<string, unknown>[],
    QueryError
  >
}
export class YatraExecutor extends Context.Service<
  YatraExecutor,
  Interface
>()("yatra/YatraExecutor") {}
// --- layers ---
/** YatraExecutor backed by any Effect SQL client. */
export const layerSqlClient = Layer.effect(
  YatraExecutor,
  Effect.gen(function* () {
    const sql = yield* SqlClient
    return YatraExecutor.of({
      query: (statement, params) =>
        sql
          .unsafe<Record<string, unknown>>(
            statement,
            params
          )
          .pipe(
            Effect.mapError(
              cause =>
                new QueryError({ sql: statement, cause })
            )
          )
    })
  })
)
/** YatraExecutor backed by an in-process PGlite (no config = in-memory). */
export const layerPglite = (
  config?: PgliteClient.PgliteClientConfig
) =>
  Layer.provide(layerSqlClient, PgliteClient.layer(config))
// --- terminal pipe steps ---
export function runEffect<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[]
>(
  ctx: QueryContext<T, M, Items>
): Effect.Effect<
  Result<QueryContext<T, M, Items>>,
  QueryError,
  YatraExecutor
> {
  return Effect.gen(function* () {
    const exec = yield* YatraExecutor
    const { sql, params } = toSQL(ctx)
    const rows = yield* exec.query(sql, params)
    if (ctx.mode === "hydrate") {
      return hydrateRows(
        ctx as QueryContext<T, "hydrate", Items>,
        rows
      ) as Result<QueryContext<T, M, Items>>
    }
    return rows as Result<QueryContext<T, M, Items>>
  })
}
export function runOneEffect<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[]
>(
  ctx: QueryContext<T, M, Items>
): Effect.Effect<
  Row<QueryContext<T, M, Items>> | null,
  QueryError,
  YatraExecutor
> {
  return Effect.map(runEffect(ctx), rows => rows[0] ?? null)
}
