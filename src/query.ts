import type { TableRelations } from "./relation";
import { info, type MakeTableObject } from "./table";
import type {
  Clean,
  QualifiedFieldName,
  Tableish,
  TableishFields,
} from "./utils";

type Join<T extends Tableish> = {
  type: "inner" | "left" | "right" | "full";
  table: Tableish;
  on: QualifiedFieldName<T>;
};

export type QueryContext<
  T extends Tableish,
  Fields = MakeTableObject<TableishFields<T>>,
> = {
  selected: string[];
  joins: any[];
  whereConditions: any[];
  orderBys: any[];
};

export function query<T extends Tableish>(table: T): QueryContext<T> {
  return {
    selected: [],
    joins: [],
    whereConditions: [],
    orderBys: [],
  };
}

export type Selectable<T extends Tableish> =
  | keyof TableishFields<T>
  | QualifiedFieldName<T>
  | keyof TableRelations<T>;

export function select<T extends Tableish, S extends Selectable<T>[]>(
  callback: (ctx: (...args: S) => S) => S,
) {
  return (
    table: T,
  ): Clean<T & { selectedFields: S }> => {
    const selector = (...args: S): S => args;

    const selectedFields = callback(selector);

    return {
      ...table,
      selectedFields,
    } as any;
  };
}
