import type {
  FieldsRecord,
  TableFields,
  TableName
} from "./table.ts"
export type Clean<T> = {
  [k in keyof T]: T[k]
} & unknown
export interface Tableish<
  TableName extends string = string,
  Fields extends FieldsRecord = FieldsRecord
> {
  new (...args: any[]): {
    [TableName]: TableName
    [TableFields]: Fields
  }
  prototype: any
}
export type TableishFields<T> =
  T extends Tableish<any, infer F> ? F : never
export type QualifiedFieldName<T> =
  T extends Tableish<infer N, infer F>
    ? `${N}.${keyof F & string}`
    : never
export function extend<This, Brand>(
  instance: This,
  propertyName: string | symbol,
  propertyValue: unknown
): This & Brand {
  const newInstance = Object.create(
    Object.getPrototypeOf(instance)
  )
  Object.assign(newInstance, instance)
  ;(newInstance as any)[propertyName] = propertyValue
  return newInstance as This & Brand
}
