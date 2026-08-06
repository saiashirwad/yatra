// The postgres dialect assembly: "ident" quoting, $n params,
// and the standard op packs from yatra-ops.
import {
  makeCompiler,
  run as coreRun,
  runOne as coreRunOne
} from "yatra"
import type {
  Compiler,
  CompiledQuery,
  Executor,
  StatementContext
} from "yatra"
import { defaultPacks } from "yatra-ops"

/** The ready-made Postgres compiler: default packs, `$n` params. */
export const postgres: Compiler = makeCompiler({
  dialect: "postgres",
  quote: ident => `"${ident}"`,
  param: i => `$${i}`,
  packs: defaultPacks
})

export function toSQL(
  ctx: StatementContext
): CompiledQuery {
  return postgres.compile(ctx)
}

export function run<E extends Executor>(
  exec: E,
  compiler: Compiler = postgres
) {
  return coreRun(exec, compiler)
}

export function runOne<E extends Executor>(
  exec: E,
  compiler: Compiler = postgres
) {
  return coreRunOne(exec, compiler)
}
