import {
  createCipheriv,
  createDecipheriv,
  createHash,
  generateKeyPair,
  privateDecrypt,
  privateEncrypt,
  publicDecrypt,
  publicEncrypt,
  randomBytes,
  scrypt,
} from "crypto";
import {
  createReadStream,
  createWriteStream,
  open,
  promises as fs,
  read,
} from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import temp from "temp";
import { v4 as uuid } from "uuid";
import Multistream from "multistream";

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
   * @param source Path of the file to be encrypted
   * @param dest  Path of the output files
   * @param from_key Key pair of the file owner
   * @param to Public key of the file viewer
   */
  static async encryptFile(
    source: string,
    dest: string,
    from_key: Pair,
    to: string
  ) {
    // [4 bytes - MAC length]
    // [4 bytes - Key length]
    // [MAC]
    // [KEY]
    // [CONTENT]
    const dir = await this.requestTempDir();
    const path_mac = `${dir}/mac.txt`;
    const path_key = `${dir}/key.txt`;
    const path_content = `${dir}/content.aes`;

    // encrypt key
    const key = randomBytes(16);
    const iv = randomBytes(16);
    const key_enc = this.encryptForAddress(
      key.toString("utf-8") + ":" + iv.toString("utf-8"),
      to
    );
    const key_bin = Buffer.from(key_enc, "base64");
    const size_key = key_bin.byteLength;
    await fs.writeFile(path_key, key_bin);

    // encrypt file
    await pipeline(
      createReadStream(source),
      createCipheriv("aes-128-cbc", key, iv),
      createWriteStream(path_content)
    );

    // sign file
    const hash = await this.hashFile(path_content);
    const hash_utf8 = Buffer.from(hash, "base64").toString("utf-8");
    const mac = this.sign(hash_utf8, from_key);
    const mac_bin = Buffer.from(mac, "base64");
    const size_mac = mac_bin.byteLength;
    await fs.writeFile(path_mac, mac_bin);

    // compile all
    const stream = Multistream([
      Readable.from(this.toInt32(size_mac)),
      Readable.from(this.toInt32(size_key)),
      createReadStream(path_mac),
      createReadStream(path_key),
      createReadStream(path_content),
    ]);
    await pipeline(stream, createWriteStream(dest));
  }

  // Request temporary file directory
  private static requestTempDir() {
    return new Promise<string>((resolve, reject) => {
      const tmp_id = uuid();
      temp.mkdir(tmp_id, (err, path) => {
        if (err) return reject(err);
        resolve(path);
      });
    });
  }

  /**
   * Returns a 4-byte buffer from javascriptnumber
   * @param num Javascript number
   * @returns Int32
   */
  private static toInt32(num: number) {
    // an Int32 takes 4 bytes
    const arr = new ArrayBuffer(4);
    const view = new DataView(arr);

    // byteOffset = 0; litteEndian = false
    view.setUint32(0, num, false);
    return Buffer.from(arr);
  }

  /**
   * Hash a file
   * @param file File path to be hashed
   * @returns SHA-256 hash in base64
   */
  static hashFile(file: string) {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash("sha256");
      hash.setEncoding("base64");
      const input = createReadStream(file);
      input.on("end", () => {
        hash.end();
        const base64 = hash.read();
        resolve(base64);
      });
      input.pipe(hash);
    });
  }

  /**
   * Decrypts a `source` to `dest`
   * @param source File to be decrypted
   * @param dest Output file
   * @param sender Public key of the sender
   * @param receiver_key Key of the receiver
   */
  static async decryptFile(
    source: string,
    dest: string,
    sender: string,
    receiver_key: Pair
  ) {
    // [4 bytes - MAC length]
    // [4 bytes - Key length]
    // [MAC]
    // [KEY]
    // [CONTENT]

    const size_mac_buff = await this.readChunkFromFile(source, 0, 4);
    const size_key_buff = await this.readChunkFromFile(source, 4, 8);

    // Convert buffers to number
    const size_mac = size_mac_buff.readInt32BE();
    const size_key = size_key_buff.readInt32BE();

    const dir = await this.requestTempDir();
    const path_key = `${dir}/key.enc`;
    const path_mac = `${dir}/mac.txt`;
    const path_content = `${dir}/content.aes`;

    // Isolate MAC
    await pipeline(
      createReadStream(source, {
        start: 4 + 4,
        end: 4 + 4 + size_mac - 1,
      }),
      createWriteStream(path_mac)
    );
    // Isolate Key
    await pipeline(
      createReadStream(source, {
        start: 4 + 4 + size_mac,
        end: 4 + 4 + size_mac + size_key - 1,
      }),
      createWriteStream(path_key)
    );
    // Isolate Content
    await pipeline(
      createReadStream(source, {
        start: 4 + 4 + size_mac + size_key,
      }),
      createWriteStream(path_content)
    );

    //verify MAC
    const mac = await fs.readFile(path_mac);
    const mac_base64 = mac.toString("base64");
    const hash = await this.hashFile(path_content);
    const is_safe = await this.verifyViaAddress(sender, mac_base64, hash);
    if (!is_safe) throw new Error("File integrity failed.");

    //decrypt key
    const key_enc = await fs.readFile(path_key);
    const key_enc_base64 = key_enc.toString("base64");
    const key_raw_utf8 = this.decrypt(key_enc_base64, receiver_key);
    const [key_utf8, iv_utf8] = key_raw_utf8.split(":");
    const [key, iv] = [
      Buffer.from(key_utf8, "utf-8"),
      Buffer.from(iv_utf8, "utf-8"),
    ];

    //decrypt file
    await pipeline(
      createReadStream(path_content),
      createDecipheriv("aes-128-cbc", key, iv),
      createWriteStream(dest)
    );
  }

  /**
   * Get a chunk of a file
   * @param file File path
   * @param start 0-index byte number
   * @param end 0-index byte number. This byte is not included in the range
   * @returns Buffer.
   */
  private static readChunkFromFile(file: string, start: number, end: number) {
    return new Promise<Buffer>((resolve, reject) => {
      open(file, "r", (err, fd) => {
        if (err) return reject(err);
        const size = end - start;
        const buffer = Buffer.alloc(size);
        read(fd, buffer, 0, size, start, (err, bytes, buff) => {
          if (err) return reject(err);
          resolve(buffer);
        });
      });
    });
  }
}
