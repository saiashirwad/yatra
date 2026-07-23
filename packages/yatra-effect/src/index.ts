import { PgliteClient } from "@effect/sql-pglite"
import { Context, Effect, Layer, Schema } from "effect"
import { SqlClient } from "effect/unstable/sql/SqlClient"
import {
  hydrateRows,
  type Mode,
  type QueryContext,
  type Row,
  type StatementKind,
  type StatementResult,
  type Tableish
} from "yatra"
import { toSQL } from "yatra-postgres"
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
  Items extends readonly unknown[],
  K extends StatementKind
>(
  ctx: QueryContext<T, M, Items, K>
): Effect.Effect<
  StatementResult<QueryContext<T, M, Items, K>>,
  QueryError,
  YatraExecutor
> {
  return Effect.gen(function* () {
    const exec = yield* YatraExecutor
    const { sql, params, projection } = toSQL(ctx)
    const rows = yield* exec.query(sql, params)
    if (ctx.kind !== "select") {
      return (
        ctx.selection.length > 0 ? rows : undefined
      ) as StatementResult<QueryContext<T, M, Items, K>>
    }
    if (ctx.mode === "hydrate") {
      return hydrateRows(
        ctx.source.table,
        rows,
        projection
      ) as StatementResult<QueryContext<T, M, Items, K>>
    }
    return rows as StatementResult<
      QueryContext<T, M, Items, K>
    >
  })
}
export function runOneEffect<
  T extends Tableish,
  M extends Mode,
  Items extends readonly unknown[]
>(
  ctx: QueryContext<T, M, Items, "select">
): Effect.Effect<
  Row<QueryContext<T, M, Items, "select">> | null,
  QueryError,
  YatraExecutor
> {
  return Effect.map(
    runEffect(ctx),
    rows =>
      (
        rows as unknown as Row<
          QueryContext<T, M, Items, "select">
        >[]
      )[0] ?? null
  )
}
