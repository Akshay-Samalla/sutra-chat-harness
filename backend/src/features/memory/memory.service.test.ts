import { test } from "node:test";
import assert from "node:assert/strict";
import { parseExtractedMemories } from "./memory.service.js";

test("memory extraction accepts short, unique facts and handles JSON code fences", () => {
  assert.deepEqual(
    parseExtractedMemories('```json\n{"memories":["Prefers concise answers","Prefers concise answers"]}\n```'),
    ["Prefers concise answers"]
  );
});

test("memory extraction rejects malformed output and filters sensitive details", () => {
  assert.equal(parseExtractedMemories("not JSON"), null);
  assert.deepEqual(
    parseExtractedMemories(JSON.stringify({
      memories: [
        "Prefers examples",
        "Email is person@example.com",
        "Their phone is +1 555 123 4567",
        "I live at 18 Example Street",
        "Their API key is abc",
        "They are seeing a therapist",
        "x".repeat(241)
      ]
    })),
    ["Prefers examples"]
  );
});
