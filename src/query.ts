import { Relation } from "./relation";
import type { TableRelations } from "./relation";
import { TableFields, TableName } from "./table";
import type { Tableish, TableishFields } from "./utils";

type QueryState = {
  readonly _selection?: unknown;
  readonly _joins?: unknown;
  readonly _where?: unknown;
  readonly _orderBy?: unknown;
};

export type QualifiedField<T extends Tableish> = T extends
  Tableish<infer TName, infer F> ? {
    [K in keyof F & string]: `${TName}.${K}`;
  }[keyof F & string]
  : never;

export type FieldSelector<T extends Tableish> =
  | keyof TableishFields<T> & string
  | QualifiedField<T>
  | keyof TableRelations<T> & string;

export interface FieldAliasObject<T extends Tableish> {
  field: FieldSelector<T>;
  as: string;
}

export type FieldWithAlias<T extends Tableish> =
  | FieldAliasObject<T>
  | FieldSelector<T>;

export type JoinType = "inner" | "left" | "right" | "full";

export interface JoinClause<T extends Tableish> {
  type: JoinType;
  target: Tableish;
  sourceKey: QualifiedField<T>;
  targetKey: string;
}

export interface WhereCondition<T extends Tableish> {
  field: FieldSelector<T>;
  operator: string;
  value: any;
}

export interface OrderByClause<T extends Tableish> {
  field: FieldSelector<T>;
  direction: "asc" | "desc";
}

export type QueryContext<
  T extends Tableish,
  State extends QueryState = {},
  SelectedFields extends ReadonlyArray<FieldSelector<T>> =
    readonly [],
  Joins extends ReadonlyArray<JoinClause<T>> = readonly [],
  WhereConditions extends ReadonlyArray<WhereCondition<T>> =
    readonly [],
  OrderByClauses extends ReadonlyArray<OrderByClause<T>> =
    readonly [],
> = {
  readonly table: T;
  readonly selected: SelectedFields;
  readonly joins: Joins;
  readonly whereConditions: WhereConditions;
  readonly orderByClauses: OrderByClauses;
  readonly state: State;
};

export function query<T extends Tableish>(
  table: T,
): QueryContext<
  T,
  {},
  readonly [],
  readonly [],
  readonly [],
  readonly []
> {
  return {
    table,
    selected: [] as const,
    joins: [] as const,
    whereConditions: [] as const,
    orderByClauses: [] as const,
    state: {},
  };
}

export function as<T extends string>(
  field: T,
  alias: string,
): FieldAliasObject<any> {
  return { field, as: alias } as FieldAliasObject<any>;
}

export function select<
  T extends Tableish,
  State extends QueryState,
  Joins extends ReadonlyArray<JoinClause<T>>,
  WhereConditions extends ReadonlyArray<WhereCondition<T>>,
  OrderByClauses extends ReadonlyArray<OrderByClause<T>>,
  const Fields extends FieldSelector<T>[],
>(
  ...fields: Fields
) {
  return <CurrentJoins extends Joins>(
    ctx: QueryContext<
      T,
      State,
      any,
      CurrentJoins,
      WhereConditions,
      OrderByClauses
    >,
  ): QueryContext<
    T,
    State & { _selection: Fields },
    readonly [...Fields],
    readonly [
      ...CurrentJoins,
      ...ComputeJoins<T, Fields, CurrentJoins>,
    ],
    WhereConditions,
    OrderByClauses
  > => {
    const newJoins = [...ctx.joins] as unknown as [
      ...CurrentJoins,
      ...ComputeJoins<T, Fields, CurrentJoins>,
    ];
    const relationFields = fields.filter(field => {
      return typeof field === "string"
        && ctx.table.prototype[field]
        && typeof Object.getOwnPropertyDescriptor(
            ctx.table.prototype,
            field,
          )
            ?.get === "function";
    });

    for (const relationName of relationFields) {
      if (typeof relationName === "string") {
        const relation = ctx.table.prototype[relationName];
        if (relation && relation instanceof Relation) {
          const alreadyJoined = ctx.joins.some(join =>
            join.target === relation.destinationTable
          );

          if (!alreadyJoined) {
            let sourceKey = "";
            let targetKey = "";

            if (
              "foreignKey" in relation
              && "referencedKey" in relation
            ) {
              sourceKey = String(relation.foreignKey);
              targetKey = String(relation.referencedKey);

              (newJoins as any).push({
                type: "left",
                target: relation.destinationTable,
                sourceKey: sourceKey as QualifiedField<T>,
                targetKey,
              });
            }
          }
        }
      }
    }

    return {
      ...ctx,
      selected: fields as readonly [...Fields],
      joins: newJoins,
      state: {
        ...ctx.state,
        _selection: fields,
      } as State & { _selection: Fields },
    };
  };
}

type ComputeJoins<
  T extends Tableish,
  Fields extends ReadonlyArray<FieldSelector<T>>,
  ExistingJoins extends ReadonlyArray<JoinClause<T>>,
> = {
  [K in keyof Fields]: Fields[K] extends
    keyof TableRelations<T> & string
    ? ExistingJoins extends
      ReadonlyArray<{ target: infer Target }>
      ? Target extends
        TableRelations<T>[Fields[K]]["destinationTable"]
        ? never // Already joined
      : JoinClause<T> // Need to join
    : JoinClause<T> // Need to join
    : never;
}[number][] extends infer R
  ? R extends never[] ? readonly []
  : R
  : readonly [];

export function orderBy<
  T extends Tableish,
  State extends QueryState,
  SelectedFields extends ReadonlyArray<FieldSelector<T>>,
  Joins extends ReadonlyArray<JoinClause<T>>,
  WhereConditions extends ReadonlyArray<WhereCondition<T>>,
  OrderByClauses extends ReadonlyArray<OrderByClause<T>>,
  Field extends FieldSelector<T>,
  Direction extends "asc" | "desc" = "asc",
>(
  field: Field,
  direction: Direction = "asc" as Direction,
) {
  return (
    ctx: QueryContext<
      T,
      State,
      SelectedFields,
      Joins,
      WhereConditions,
      OrderByClauses
    >,
  ): QueryContext<
    T,
    State & { _orderBy: true },
    SelectedFields,
    Joins,
    WhereConditions,
    readonly [
      ...OrderByClauses,
      { field: Field; direction: Direction },
    ]
  > => {
    const orderByClause = { field, direction } as const;

    return {
      ...ctx,
      orderByClauses: [
        ...ctx.orderByClauses,
        orderByClause,
      ] as readonly [
        ...OrderByClauses,
        { field: Field; direction: Direction },
      ],
      state: {
        ...ctx.state,
        _orderBy: true,
      } as State & { _orderBy: true },
    };
  };
}

export function where<
  T extends Tableish,
  State extends QueryState,
  SelectedFields extends ReadonlyArray<FieldSelector<T>>,
  Joins extends ReadonlyArray<JoinClause<T>>,
  WhereConditions extends ReadonlyArray<WhereCondition<T>>,
  OrderByClauses extends ReadonlyArray<OrderByClause<T>>,
  Field extends FieldSelector<T>,
  Operator extends string,
  Value extends any,
>(
  field: Field,
  operator: Operator,
  value: Value,
) {
  return (
    ctx: QueryContext<
      T,
      State,
      SelectedFields,
      Joins,
      WhereConditions,
      OrderByClauses
    >,
  ): QueryContext<
    T,
    State & { _where: true },
    SelectedFields,
    Joins,
    readonly [
      ...WhereConditions,
      { field: Field; operator: Operator; value: Value },
    ],
    OrderByClauses
  > => {
    const whereCondition = {
      field,
      operator,
      value,
    } as const;

    return {
      ...ctx,
      whereConditions: [
        ...ctx.whereConditions,
        whereCondition,
      ] as readonly [
        ...WhereConditions,
        { field: Field; operator: Operator; value: Value },
      ],
      state: {
        ...ctx.state,
        _where: true,
      } as State & { _where: true },
    };
  };
}

export function join<
  T extends Tableish,
  State extends QueryState,
  SelectedFields extends ReadonlyArray<FieldSelector<T>>,
  Joins extends ReadonlyArray<JoinClause<T>>,
  WhereConditions extends ReadonlyArray<WhereCondition<T>>,
  OrderByClauses extends ReadonlyArray<OrderByClause<T>>,
  RelationName extends keyof TableRelations<T> & string,
  JT extends JoinType = "inner",
>(
  relationName: RelationName,
  joinType: JT = "inner" as JT,
) {
  return (
    ctx: QueryContext<
      T,
      State,
      SelectedFields,
      Joins,
      WhereConditions,
      OrderByClauses
    >,
  ): QueryContext<
    T,
    State & { _joins: true },
    SelectedFields,
    readonly [...Joins, {
      type: JT;
      target: TableRelations<
        T
      >[RelationName]["destinationTable"];
      sourceKey: string;
      targetKey: string;
    }],
    WhereConditions,
    OrderByClauses
  > => {
    const relation = ctx.table
      .prototype[relationName] as Relation<T, any>;

    if (!relation) {
      throw new Error(
        `Relation ${String(relationName)} not found on ${
          String(ctx.table.prototype[TableName])
        }`,
      );
    }

    let sourceKey = "";
    let targetKey = "";

    if (
      "foreignKey" in relation
      && "referencedKey" in relation
    ) {
      sourceKey = String(relation.foreignKey);
      targetKey = String(relation.referencedKey);
    } else {
      throw new Error(
        `Unsupported relation type for ${
          String(relationName)
        }`,
      );
    }

    const joinClause = {
      type: joinType,
      target: relation.destinationTable,
      sourceKey: sourceKey as QualifiedField<T>,
      targetKey,
    } as const;

    return {
      ...ctx,
      joins: [...ctx.joins, joinClause] as readonly [
        ...Joins,
        {
          type: JT;
          target: TableRelations<
            T
          >[RelationName]["destinationTable"];
          sourceKey: string;
          targetKey: string;
        },
      ],
      state: {
        ...ctx.state,
        _joins: true,
      } as State & { _joins: true },
    };
  };
}

export function toSQL<
  T extends Tableish,
  State extends QueryState,
  SelectedFields extends ReadonlyArray<FieldSelector<T>>,
  Joins extends ReadonlyArray<JoinClause<T>>,
  WhereConditions extends ReadonlyArray<WhereCondition<T>>,
  OrderByClauses extends ReadonlyArray<OrderByClause<T>>,
>(
  ctx: QueryContext<
    T,
    State,
    SelectedFields,
    Joins,
    WhereConditions,
    OrderByClauses
  >,
): string {
  return "whaaat, i need to do this too?";
}
