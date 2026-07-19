import type { PGlite } from "@electric-sql/pglite"
import type { Executor } from "yatra"
export function pgliteExecutor(db: PGlite): Executor {
  return {
    query: async (sql, params) =>
      (await db.query(sql, params as unknown[]))
        .rows as Record<string, unknown>[]
  }
}
