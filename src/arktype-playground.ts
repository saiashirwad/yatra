import { ArkError, ArkErrors, scope, type } from "arktype";

const lol = type({
  something: "Map",
});

const result = lol({
  something: new WeakMap(),
});

if (result instanceof ArkErrors) {
  console.log(result);
  console.log(result.summary);
} else {
  console.log(result);
}
