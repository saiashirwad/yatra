import type { FieldsRecord, TableFields, TableName } from "./table";

export type Clean<T> = {
  [k in keyof T]: T[k];
} & unknown;

export type Class<O extends Record<string, unknown>> = {
  new (): InstanceType<new () => O>;
};

export type Constructor<Args = any, ReturnType = any> = new (...args: Args[]) => ReturnType;

/**
 * A curried type-safe wrapper around Reflect.construct
 *
 * @param constructor - The constructor function to invoke
 * @returns A function that accepts constructor arguments and returns an instance
 */

// biome-ignore lint/suspicious/noShadowRestrictedNames: <explanation>
export function construct<T extends new (...args: any[]) => any>(constructor: T) {
  return <A extends ConstructorParameters<T>>(...args: A): InstanceType<T> => {
    return Reflect.construct(constructor, args) as InstanceType<T>;
  };
}

export type ExtractKeys<T> = T extends {
  prototype: infer P;
}
  ? keyof P & string
  : string;

export interface Tableish<
  TableName extends string = string,
  Fields extends FieldsRecord = FieldsRecord,
> {
  new (
    ...args: any[]
  ): {
    [TableName]: TableName;
    [TableFields]: Fields;
  };
  prototype: any;
}

export type TableishFields<T> = T extends Tableish<any, infer F> ? F : never;

export type QualifiedFieldName<T> = T extends Tableish<infer N, infer F>
  ? `${N}.${keyof F & string}`
  : never;

export function extend<This, Brand>(
  instance: This,
  propertyName: string | symbol,
  propertyValue: unknown,
): This & Brand {
  const newInstance = Object.create(Object.getPrototypeOf(instance));
  Object.assign(newInstance, instance);
  (newInstance as any)[propertyName] = propertyValue;
  return newInstance as This & Brand;
}
