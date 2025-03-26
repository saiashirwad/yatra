import {
  number,
  string,
  time,
} from "./columns/base-columns";
import {
  autoIncrement,
  columnName,
  minLength,
  nullable,
  primaryKey,
  unique,
} from "./columns/properties";
import { pipe } from "./pipe";

const userNameColumn = pipe(
  string(),
  columnName("user_name"),
  minLength(3),
  unique,
  nullable,
);

const idColumn = pipe(
  number(),
  columnName("id"),
  primaryKey,
  autoIncrement,
);

console.log(idColumn);
console.log(userNameColumn);

const ha = pipe(
  time(),
  columnName("ha"),
);
