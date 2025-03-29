import { type Pipeable, pipeArguments } from "./pipeable";
import { DestinationTable, SourceTable } from "./symbols";
import type { TableLike } from "./utils";

/**
 * Base relation class that all specific relation types extend
 */
export class Relation<
  Source extends TableLike,
  Destination extends TableLike,
> implements Pipeable {
  public [SourceTable]: Source;
  public [DestinationTable]: Destination;

  constructor(
    source: () => Source,
    destination: () => Destination,
  ) {
    this[SourceTable] = source();
    this[DestinationTable] = destination();
  }

  pipe(...fns: Array<Function>) {
    return pipeArguments(
      this,
      arguments,
    );
  }

  get sourceTable() {
    return this[SourceTable];
  }

  get destinationTable() {
    return this[DestinationTable];
  }
}
