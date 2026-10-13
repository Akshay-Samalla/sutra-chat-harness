import {
  createCipheriv,
  createDecipheriv,
  randomBytes
} from "node:crypto";

function encryptionKey(): Buffer {
  const configured = process.env.TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (/^[0-9a-fA-F]{64}$/.test(configured)) {
    return Buffer.from(configured, "hex");
  }

  const decoded = Buffer.from(configured, "base64");
  if (decoded.length === 32) {
    return decoded;
  }

  throw new Error(
    "Set TOKEN_ENCRYPTION_KEY to a 32-byte key (64 hexadecimal or base64 characters) before saving provider credentials."
  );
}

export function encryptProviderToken(token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
}

export function decryptProviderToken(encrypted: string): string {
  const [ivPart, tagPart, ciphertextPart, ...extra] = encrypted.split(".");
  if (!ivPart || !tagPart || !ciphertextPart || extra.length > 0) {
    throw new Error("Saved provider credential has an invalid encrypted format.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivPart, "base64url")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, "base64url")),
    decipher.final()
  ]).toString("utf8");
}
