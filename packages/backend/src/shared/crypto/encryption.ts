import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class Encryption {
  private readonly key: Buffer;

  constructor(hexKey: string) {
    const keyBuffer = Buffer.from(hexKey, "hex");
    if (keyBuffer.length !== 32) {
      throw new Error("Encryption key must be 32 bytes (64 hex characters)");
    }
    this.key = keyBuffer;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Format: iv(12) + authTag(16) + ciphertext
    const result = Buffer.concat([iv, authTag, encrypted]);
    return result.toString("base64");
  }

  decrypt(ciphertext: string): string {
    const data = Buffer.from(ciphertext, "base64");

    if (data.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new Error("Invalid ciphertext: too short");
    }

    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    return decipher.update(encrypted) + decipher.final("utf8");
  }
}
