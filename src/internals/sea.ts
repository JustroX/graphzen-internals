import {
  createHash,
  generateKeyPair,
  privateDecrypt,
  privateEncrypt,
  publicDecrypt,
  publicEncrypt,
  randomBytes,
  scrypt,
} from "crypto";

export interface Pair {
  pub: string;
  priv: string;
}

export class SEA {
  /**
   * Generates a pair of keys
   * @returns Pair
   */
  static pair(): Promise<Pair> {
    return new Promise((resolve, reject) => {
      generateKeyPair(
        "rsa",
        {
          modulusLength: 4096,
          publicKeyEncoding: {
            type: "spki",
            format: "pem",
          },
          privateKeyEncoding: {
            type: "pkcs8",
            format: "pem",
            cipher: "aes-256-cbc",
            passphrase: process.env.PEM_PASSPHRASE,
          },
        },
        (err, pub, priv) => {
          if (err) return reject(err);
          resolve({
            pub,
            priv,
          });
        }
      );
    });
  }

  /**
   * Encrypts plaintext using the public key `pub`.
   * Returns in base64 format.
   * @param data plaintext
   * @param pub public key
   */
  static encryptForAddress(data: string, pub: string): string {
    const encrypted = publicEncrypt(pub, Buffer.from(data, "utf-8"));
    const base64 = encrypted.toString("base64");
    return base64;
  }

  /**
   * Encrypts plaintext using the public key of `key`.
   * Returns in base64 format.
   * @param data plaintext
   * @param key Key pair
   */
  static encrypt(data: string, key: Pair): string {
    return this.encryptForAddress(data, key.pub);
  }

  /**
   * Decrypts an encrypted string using the private key of `key`
   * @param data Encrypted string in base64
   * @param key Key pair
   */
  static decrypt(data: string, key: Pair): string {
    const plain = privateDecrypt(key.priv, Buffer.from(data, "base64"));
    const utf8 = plain.toString("utf-8");
    return utf8;
  }

  /**
   * Cryptographically sign a string using the private key of `key`.
   * Returns signature in base64
   * @param data MAC or string
   * @param key Key pair
   */
  static sign(data: string, key: Pair): string {
    const mac = privateEncrypt(key.priv, Buffer.from(data, "utf-8"));
    const base64 = mac.toString("base64");
    return base64;
  }

  /**
   * Verifies a cryptographic signature of a public key.
   * @param pub Public key
   * @param data Signature in base64
   * @param expected Expected MAC
   */
  static verifyViaAddress(
    pub: string,
    data: string,
    expected: string
  ): boolean {
    try {
      const mac = publicDecrypt(pub, Buffer.from(data, "base64"));
      const utf8 = mac.toString("utf-8");
      return utf8 == expected;
    } catch (err) {
      return false;
    }
  }

  /**
   * Verifies a cryptographic signature from the public key of `key` or address.
   * @param key Key pair
   * @param data Signature in base64
   * @param expected Expected MAC
   */
  static verify(key: Pair, data: string, expected: string): boolean {
    return this.verifyViaAddress(key.pub, data, expected);
  }

  /**
   * Returns SHA-256 hash of a text in base64.
   * @param data Plaintext
   */
  static hash(data: string): string {
    return createHash("sha256").update(data).digest("base64");
  }

  /**
   * Deterministically generates a random `length`-bit string in base64
   * @param data Phrase
   * @param salt Phrase
   * @param length Length in bits
   */
  static work(data: string, salt: string, length: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      scrypt(data, salt, length, (err, key) => {
        if (err) return reject(err);
        resolve(key.toString("base64"));
      });
    });
  }

  /**
   * Encrypts `source` to `dest`
   * @param path Path of the file
   * @param key Key pair
   */
  static encryptFile(source: string, dest: string, pub: string) {
    const symmetric_key = randomBytes(16);

    throw new Error("Not yet implemented.");
  }

  /**
   * Decrypts a `source` to `dest`
   * @param path Path of the file
   * @param key Key pair
   */
  static decryptFile(source: string, dest: string, key: Pair) {
    throw new Error("Not yet implemented.");
  }
}
