type Clean<T> = { [k in keyof T]: T[k] } & unknown;

function* set<const R>(r: R) {
  yield r;
}

function* hi() {
  yield* set({ hi: "there" });
  yield* set({ name: "sai" });
}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends
  ((k: infer I) => void) ? I : never;

type GeneratorResult<R> = R extends Generator<infer V, any, any> ? V : never;

type CleanResult<T extends (...args: any[]) => any> = Clean<
  UnionToIntersection<GeneratorResult<ReturnType<T>>>
>;

type Result = CleanResult<typeof hi>;
