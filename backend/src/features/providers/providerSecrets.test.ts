import assert from "node:assert/strict";
import { after, test } from "node:test";
import { decryptProviderToken, encryptProviderToken } from "./providerSecrets.js";

const originalKey = process.env.TOKEN_ENCRYPTION_KEY;
const testKey = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

after(() => {
  if (originalKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY;
  else process.env.TOKEN_ENCRYPTION_KEY = originalKey;
});

test("provider tokens encrypt, decrypt, and reject tampering", () => {
  process.env.TOKEN_ENCRYPTION_KEY = testKey;
  const token = "sutra-test-provider-token";
  const encrypted = encryptProviderToken(token);
  const [iv, tag, ciphertext] = encrypted.split(".");
  const changedTag = `${tag?.[0] === "A" ? "B" : "A"}${tag?.slice(1) ?? ""}`;

  assert.notEqual(encrypted, token);
  assert.equal(encrypted.includes(token), false);
  assert.equal(decryptProviderToken(encrypted), token);
  assert.throws(() => decryptProviderToken(`${iv}.${changedTag}.${ciphertext}`));
});

test("saving a provider token requires a valid encryption key", () => {
  process.env.TOKEN_ENCRYPTION_KEY = "";
  assert.throws(() => encryptProviderToken("sutra-test-provider-token"), {
    message: /Set TOKEN_ENCRYPTION_KEY/
  });
});
