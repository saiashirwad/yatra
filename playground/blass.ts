const data = {
  items: [{ name: "colinhacks" }],
  foo: { bar: true },
  get deeper() {
    return data;
  },
};

const out = get(
  data,
  "deeper.deeper.items.0.name",
);

type haha<path extends string> = conform<
  path,
  & string
  & validatePath<typeof data, path>
>;

function get<
  const o extends object,
  path extends string,
>(
  data: o,
  pathStr: conform<
    path,
    string & validatePath<o, path>
  >,
): getPath<o, path> {
  let target: any = data;
  const path = pathStr.split(".");
  while (path.length) {
    target = target[path.shift()!];
  }
  return target;
}

/** Mimics the result of Object.keys(...) */
type keyOf<o> = o extends readonly unknown[]
  ? number extends o["length"] ? `${number}`
  : keyof o & `${number}`
  : {
    [k in keyof o]: k extends string ? k
      : k extends number ? `${k}`
      : never;
  }[keyof o];

type getKey<o, k> = k extends keyof o ? o[k]
  : k extends `${infer n extends number & keyof o}` ? o[n]
  : never;

type getPath<o, path extends string> = path extends
  `${infer head}.${infer tail}` ? getPath<getKey<o, head>, tail>
  : getKey<o, path>;

type validatePath<
  o,
  path extends string,
  prefix extends string = "",
> = path extends `${infer head}.${infer tail}`
  ? head extends keyOf<o> ? validatePath<
      getKey<o, head>,
      tail,
      `${prefix}${head}.`
    >
  : `Key '${head}' is not valid following '${prefix}'`
  : path extends keyOf<o> ? `${prefix}${path}`
  : {
    // find suffixes that would make the segment valid
    [k in keyOf<o>]: k extends `${path}${string}` ? `${prefix}${k}`
      : never;
  }[keyOf<o>];

type conform<t, base> = t extends base ? t : base;
