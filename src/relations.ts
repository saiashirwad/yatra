import {
  type FieldsRecord,
  type ManyToManyRelation,
  type ManyToOneRelation,
  type OneToManyRelation,
  type OneToOneRelation,
  type TableConstructor,
} from "./types";

class ManyToManyBuilder<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
> {
  private virtualField?: keyof Fields;
  private foreignKey?: keyof InstanceType<ReturnType<Ref>>["fields"];
  constructor(private fields: Fields, private ref: Ref) {}
  using<VF extends keyof Fields>(virtualField: VF) {
    this.virtualField = virtualField;
    return this;
  }
  references<
    FK extends keyof InstanceType<ReturnType<Ref>>["fields"],
  >(foreignKey: FK) {
    this.foreignKey = foreignKey;
    return this;
  }
  build(): ManyToManyRelation<
    Ref,
    keyof Fields,
    keyof InstanceType<ReturnType<Ref>>["fields"]
  > {
    if (!this.virtualField || !this.foreignKey) {
      throw new Error(
        "ManyToMany relation requires both virtualField and foreignKey",
      );
    }
    return {
      kind: "many-to-many",
      ref: this.ref,
      virtualField: this.virtualField,
      foreignKey: this.foreignKey,
    };
  }
}

class ManyToOneBuilder<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
> {
  private virtualField?: keyof Fields;
  private foreignKey?: keyof InstanceType<ReturnType<Ref>>["fields"];
  constructor(private fields: Fields, private ref: Ref) {}
  using<VF extends keyof Fields>(virtualField: VF) {
    this.virtualField = virtualField;
    return this;
  }
  references<
    FK extends keyof InstanceType<ReturnType<Ref>>["fields"],
  >(foreignKey: FK) {
    this.foreignKey = foreignKey;
    return this;
  }
  build(): ManyToOneRelation<
    Ref,
    keyof Fields,
    keyof InstanceType<ReturnType<Ref>>["fields"]
  > {
    if (!this.virtualField || !this.foreignKey) {
      throw new Error(
        "ManyToOne relation requires both virtualField and foreignKey",
      );
    }
    return {
      kind: "many-to-one",
      ref: this.ref,
      virtualField: this.virtualField,
      foreignKey: this.foreignKey,
    };
  }
}

class OneToManyBuilder<Ref extends () => any> {
  constructor(private ref: Ref) {}
  build(): OneToManyRelation<Ref> {
    return { kind: "one-to-many", ref: this.ref };
  }
}

class OneToOneBuilder<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
  const Index extends string,
> {
  private virtualField?: keyof Fields;
  private foreignKey?: keyof InstanceType<ReturnType<Ref>>["fields"];
  constructor(private fields: Fields, private ref: Ref) {}

  using<VF extends keyof Fields>(virtualField: VF) {
    this.virtualField = virtualField;
    return this;
  }

  references<
    FK extends keyof InstanceType<ReturnType<Ref>>["fields"],
  >(foreignKey: FK) {
    this.foreignKey = foreignKey;
    return this;
  }

  build(): OneToOneRelation<
    Ref,
    keyof Fields,
    keyof InstanceType<ReturnType<Ref>>["fields"]
  > {
    if (!this.virtualField || !this.foreignKey) {
      throw new Error(
        "OneToOne relation requires both virtualField and foreignKey",
      );
    }
    return {
      kind: "one-to-one",
      ref: this.ref,
      virtualField: this.virtualField,
      foreignKey: this.foreignKey,
    };
  }
}

export function manyToMany<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
>(
  t: Fields,
  ref: Ref,
): ManyToManyBuilder<Fields, Ref> {
  return new ManyToManyBuilder(t, ref);
}

export function manyToOne<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
>(
  t: Fields,
  ref: Ref,
): ManyToOneBuilder<Fields, Ref> {
  return new ManyToOneBuilder(t, ref);
}

export function oneToMany<
  Fields extends FieldsRecord,
  Ref extends () => any,
>(
  t: Fields,
  ref: Ref,
): OneToManyBuilder<Ref> {
  return new OneToManyBuilder(ref);
}

export function oneToOne<
  Fields extends FieldsRecord,
  Ref extends () => TableConstructor<any>,
  const Index extends string,
>(
  t: Fields,
  ref: Ref,
): OneToOneBuilder<Fields, Ref, Index> {
  return new OneToOneBuilder(t, ref);
}
