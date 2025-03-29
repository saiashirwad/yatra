export type Clean<T> =
  & { [k in keyof T]: T[k] }
  & unknown;

export type Class<
  O extends Record<string, unknown>,
> = {
  new(): InstanceType<new() => O>;
};

export type Constructor<
  Args = any,
  ReturnType = any,
> = new(
  ...args: Args[]
) => ReturnType;

/**
 * A curried type-safe wrapper around Reflect.construct
 *
 * @param constructor - The constructor function to invoke
 * @returns A function that accepts constructor arguments and returns an instance
 */
export function construct<T extends new(...args: any[]) => any>(
  constructor: T,
) {
  return <A extends ConstructorParameters<T>>(
    ...args: A
  ): InstanceType<T> => {
    return Reflect.construct(constructor, args) as InstanceType<T>;
  };
}

export type ExtractKeys<T> = T extends { prototype: infer P } ? keyof P & string
  : string;
