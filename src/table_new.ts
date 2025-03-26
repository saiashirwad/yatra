import type { Column } from "./columns/column";
import type { IsNullable } from "./columns/properties";

type InferColumn<C> = C extends Column<any, infer T>
  ? IsNullable<C> extends true ? T | null : T
  : never;

type InferFields<CR extends Record<string, Column<any, any>>> = {
  [k in keyof CR]: InferColumn<CR[k]>;
};
