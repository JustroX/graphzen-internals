import { Pair, SEA } from "./sea";

export class Identity {
  private constructor(public alias: string, public pair: Pair) {}

  static fromPair(alias: string, pair: Pair): Identity {
    return new Identity(alias, pair);
  }

  static fromJSON(json: string): Identity {
    throw new Error("Not yet implemented.");
  }

  toJson(): string {
    throw new Error("Not yet implemented.");
  }

  getID(): string {
    return this.pair.pub;
  }

  sign(data: string): string {
    return SEA.sign(data, this.pair);
  }
}
