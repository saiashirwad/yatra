import { string, uuid } from "./columns/base-columns";
import type { Column } from "./columns/column";
import { primaryKey } from "./columns/properties";
import { pipe } from "./pipe";

namespace TableArgs {
  export type Fields = Record<string, Column<any, any>>;
  export type Relations = Record<string, any>;
  export type Indices = Record<string, any>;
}

interface TableParams<
  Fields extends TableArgs.Fields,
  Relations extends TableArgs.Relations,
  Indices extends TableArgs.Indices,
> {
  fields: Fields;
  relations?: Relations;
  indices?: Indices;
}

function table<
  Fields extends TableArgs.Fields,
  Relations extends TableArgs.Relations,
  Indices extends TableArgs.Indices,
>(
  params: TableParams<Fields, Relations, Indices>,
): {
  relations: Relations;
  indices: Indices;
  fields: Fields;
} {
  return {
    ...params,
    relations: params.relations ?? ({} as any),
    indices: params.indices ?? ({} as any),
  };
}

const Tags = table({
  fields: {
    id: pipe(uuid(), primaryKey),
    name: string(),
  },
  relations: {},
});

const Book = table({
  fields: {
    id: pipe(uuid(), primaryKey),
    name: string(),
  },
  relations: {
    tags: () => Tags,
  },
  indices: {},
});
