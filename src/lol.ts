class TSet<const K extends string, const V> {
  constructor(
    public k: K,
    public v: V,
  ) {}
}

function* mlem() {
  yield new TSet("item1", 1);
  yield new TSet("item2", "two");
  yield new TSet("item3", true);
  yield new TSet("item4", 4);
  yield new TSet("item5", "five");
  yield new TSet("item6", false);
  yield new TSet("item7", 7);
  yield new TSet("item8", "eight");
  yield new TSet("item9", true);
  yield new TSet("item10", 10);
  yield new TSet("item11", "eleven");
  yield new TSet("item12", false);
  yield new TSet("item13", 13);
  yield new TSet("item14", "fourteen");
  yield new TSet("item15", true);
  yield new TSet("item16", 16);
  yield new TSet("item17", "seventeen");
  yield new TSet("item18", false);
  yield new TSet("item19", 19);
  yield new TSet("item20", "twenty");
  yield new TSet("item21", true);
  yield new TSet("item22", 22);
  yield new TSet("item23", "twenty-three");
  yield new TSet("item24", false);
  yield new TSet("item25", 25);
  yield new TSet("item26", "twenty-six");
  yield new TSet("item27", true);
  yield new TSet("item28", 28);
  yield new TSet("item29", "twenty-nine");
  yield new TSet("item30", false);
  yield new TSet("item31", 31);
  yield new TSet("item32", "thirty-two");
  yield new TSet("item33", true);
  yield new TSet("item34", 34);
  yield new TSet("item35", "thirty-five");
  yield new TSet("item36", false);
  yield new TSet("item37", 37);
  yield new TSet("item38", "thirty-eight");
  yield new TSet("item39", true);
  yield new TSet("item40", 40);
  yield new TSet("item41", "forty-one");
  yield new TSet("item42", false);
  yield new TSet("item43", 43);
  yield new TSet("item44", "forty-four");
  yield new TSet("item45", true);
  yield new TSet("item46", 46);
  yield new TSet("item47", "forty-seven");
  yield new TSet("item48", false);
  yield new TSet("item49", 49);
  yield new TSet("item50", "fifty");
  yield new TSet("item51", true);
  yield new TSet("item52", 52);
  yield new TSet("item53", "fifty-three");
  yield new TSet("item54", false);
  yield new TSet("item55", 55);
  yield new TSet("item56", "fifty-six");
  yield new TSet("item57", true);
  yield new TSet("item58", 58);
  yield new TSet("item59", "fifty-nine");
  yield new TSet("item60", false);
  yield new TSet("item61", 61);
  yield new TSet("item", "sixty-two");
  yield new TSet("item", true);
  yield new TSet("item", 64);
  yield new TSet("item65", "sixty-five");
  yield new TSet("item66", false);
  yield new TSet("item67", 67);
  yield new TSet("item68", "sixty-eight");
  yield new TSet("item69", true);
  yield new TSet("item70", 70);
  yield new TSet("item71", "seventy-one");
  yield new TSet("item72", false);
  yield new TSet("item73", 73);
  yield new TSet("item74", "seventy-four");
  yield new TSet("item75", true);
  yield new TSet("item76", 76);
  yield new TSet("item77", "seventy-seven");
  yield new TSet("item78", false);
  yield new TSet("item79", 79);
  yield new TSet("item80", "eighty");
  yield new TSet("item81", true);
  yield new TSet("item82", 82);
  yield new TSet("item83", "eighty-three");
  yield new TSet("item84", false);
  yield new TSet("item85", 85);
  yield new TSet("item86", "eighty-six");
  yield new TSet("item87", true);
  yield new TSet("item88", 88);
  yield new TSet("item89", "eighty-nine");
  yield new TSet("item90", false);
  yield new TSet("item91", 91);
  yield new TSet("item92", "ninety-two");
  yield new TSet("item93", true);
  yield new TSet("item94", 94);
  yield new TSet("item95", "ninety-five");
  yield new TSet("item96", false);
  yield new TSet("item97", 97);
  yield new TSet("item98", "ninety-eight");
  yield new TSet("item99", true);
  yield new TSet("item100", 100);
}

type IteratorYield<T> = T extends
  () => IterableIterator<infer Y> ? Y : never;
type YieldedType = IteratorYield<typeof mlem>;

type Includes<T, U> = U extends T ? true : false;
type Result = Includes<YieldedType, TSet<"item4", 4>>;
