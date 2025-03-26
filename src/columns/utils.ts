import type { ColumnPropertyName } from "./properties";

export function extend<This, Brand>(
  instance: This,
  propertyName: ColumnPropertyName,
  propertyValue: unknown,
): This & Brand {
  const newInstance = Object.create(
    Object.getPrototypeOf(instance),
  );

  Object.assign(newInstance, instance);
  (newInstance as any)[propertyName] =
    propertyValue;

  return newInstance as This & Brand;
}
