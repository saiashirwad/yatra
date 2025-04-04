interface TableParams<
  Fields extends Record<string, string>,
  Relations extends Partial<Record<keyof Fields, () => any>>,
  Indices extends Partial<Record<keyof Fields, string>> = {},
> {
  fields: Fields;
  relations?: Relations;
  indices?: Indices;
}

function table<
  const Fields extends Record<string, string>,
  const Relations extends Partial<Record<keyof Fields, () => any>>,
  const Indices extends Partial<Record<keyof Fields, string>> = {},
>(
  params: TableParams<Fields, Relations, Indices>,
): { relations: Relations; indices: Indices; fields: Fields } {
  return {
    ...params,
    relations: params.relations ?? {} as any,
    indices: params.indices ?? {} as any,
  };
}

const Tags = table({
  fields: {
    id: "string",
    name: "string",
  },
  relations: {},
});

const Something = table({
  fields: {
    name: "hi",
    age: "s",
  },
  relations: {
    name: () => Book,
  },
  indices: {},
});

const Book = table({
  fields: {
    id: "string",
  },
  relations: {
    id: () => Something,
  },
  indices: {},
});
