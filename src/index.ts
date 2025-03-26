import { pipe, Pipeable } from "effect";

interface Something<S> extends Pipeable.Pipeable {
  str: S;
  map: <T>(fn: (s: S) => T) => Something<T>;
}

function makeSomething<const S>(str: S): Something<S> {
  return {
    str,
    map: (fn) => makeSomething(fn(str)),
    pipe() {
      return Pipeable.pipeArguments(this, arguments);
    },
  } as Something<S>;
}

type MapFn<S, T> = (s: S) => T;

function map<const S, const T>(
  fn: MapFn<S, T>,
): (something: Something<S>) => Something<T> {
  return (something: Something<S>) => makeSomething(fn(something.str));
}

type UppercaseEverything<S> = S extends string ? Uppercase<S>
  : S extends Record<any, any>
    ? { [K in keyof S as K extends string ? Uppercase<K> : K]: Uppercase<S[K]> }
  : never;

const uppercase = <const S extends string | Record<string, string>>() =>
  map<S, UppercaseEverything<S>>(s => {
    if (typeof s === "object") {
      const result = {} as any;
      for (const key in s) {
        result[key.toUpperCase() as any] = (s[key] as string).toUpperCase();
      }
      return result;
    }
    if (typeof s === "string") {
      return s.toUpperCase() as any;
    }
  });

const something = makeSomething({ hi: "there" });

const result = something.pipe(
  map(s => ({ ...s, lol: "wut" })),
  uppercase(),
);

const lol = makeSomething("lol").pipe(
  uppercase(),
);

const result2 = pipe(lol, map(s => `${s} - ${s}`));

console.log({ result, lol });
