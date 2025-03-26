import { Schema } from "effect";

class Lol extends Schema.Class<Lol>("Lol")({
  name: Schema.String,
}) {}

console.log(Lol);

const lol = new Lol({ name: "hi" });

console.log(lol);
