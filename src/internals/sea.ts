export interface Pair {
  pub: string;
  priv: string;
}

export class SEA {
  static pair(): Pair {
    throw new Error("Not yet implemented.");
  }

  static encrypt(data: string, key: Pair): string {
    throw new Error("Not yet implemented.");
  }

  static decrypt(data: string, key: Pair): string {
    throw new Error("Not yet implemented.");
  }

  static sign(data: string, key: Pair): string {
    throw new Error("Not yet implemented.");
  }

  static verify(data: string, key: Pair): string {
    throw new Error("Not yet implemented.");
  }

  static hash(data: string): string {
    throw new Error("Not yet implemented.");
  }

  static work(data: string, length: number): string {
    throw new Error("Not yet implemented.");
  }

  static encryptFile(path: string, key: Pair) {
    throw new Error("Not yet implemented.");
  }

  static decryptFile(path: string, key: Pair) {
    throw new Error("Not yet implemented.");
  }
}
