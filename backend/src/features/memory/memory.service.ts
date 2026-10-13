import { createHash } from "node:crypto";
import type OpenAI from "openai";
import { Memory, type StoredMemoryScope } from "../../models/Memory.js";
import { MemorySettings } from "../../models/MemorySettings.js";

const MAX_MEMORIES_PER_SCOPE = 30;
const MAX_EXTRACTED_MEMORIES = 6;
const MAX_MEMORY_LENGTH = 240;

export function parseExtractedMemories(response: string): string[] | null {
  const json = response.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("memories" in parsed) ||
    !Array.isArray(parsed.memories)
  ) {
    return null;
  }

  const unique = new Set<string>();
  for (const value of parsed.memories.slice(0, MAX_EXTRACTED_MEMORIES)) {
    if (typeof value !== "string") continue;
    const content = value.trim().replace(/\s+/g, " ");
    if (
      !content ||
      content.length > MAX_MEMORY_LENGTH ||
      containsSensitiveDetail(content)
    ) {
      continue;
    }
    unique.add(content);
  }
  return [...unique];
}

export async function extractMemoryFacts(
  client: OpenAI,
  model: string,
  userMessage: string,
  existingMemories: string[],
  signal?: AbortSignal
): Promise<string[]> {
  if (containsSensitiveDetail(userMessage)) return [];
  const response = await client.chat.completions.create(
    {
      model,
      temperature: 0,
      max_tokens: 350,
      messages: [
        {
          role: "system",
          content:
            "Extract only stable, useful facts or preferences that the user explicitly stated about themselves. " +
            "Never infer facts. Do not save sensitive personal data (health, politics, religion, sexuality, precise location, " +
            "financial or legal details), credentials, contact information, or temporary details. " +
            "Return only valid JSON in the exact shape {\"memories\":[\"short fact\"]}. " +
            "Return an empty array when there is nothing appropriate to remember. Existing memories are supplied only to avoid duplicates."
        },
        {
          role: "user",
          content: JSON.stringify({ latestUserMessage: userMessage, existingMemories })
        }
      ]
    },
    { signal }
  );
  const content = response.choices[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("The model returned no memory extraction result.");
  }
  const memories = parseExtractedMemories(content);
  if (!memories) {
    throw new Error("The model returned an unreadable memory extraction result.");
  }
  return memories;
}

export async function getMemorySettings(
  ownerId: string
): Promise<{ enabled: boolean; revision: number }> {
  const settings = await MemorySettings.findOne({ ownerId })
    .select("enabled revision")
    .lean();
  return { enabled: settings?.enabled ?? true, revision: settings?.revision ?? 0 };
}

export async function advanceMemoryRevision(ownerId: string): Promise<void> {
  await MemorySettings.updateOne(
    { ownerId },
    { $inc: { revision: 1 }, $setOnInsert: { enabled: true } },
    { upsert: true, setDefaultsOnInsert: true }
  );
}

export async function saveMemoryFacts(
  ownerId: string,
  scope: StoredMemoryScope,
  scopeId: string,
  facts: string[]
): Promise<void> {
  for (const content of facts) {
    const fingerprint = createHash("sha256")
      .update(content.normalize("NFKC").toLocaleLowerCase())
      .digest("hex");
    await Memory.updateOne(
      { ownerId, scope, scopeId, fingerprint },
      {
        $set: { content },
        $setOnInsert: { ownerId, scope, scopeId, fingerprint }
      },
      { upsert: true, runValidators: true }
    );
  }

  const overflow = await Memory.find({ ownerId, scope, scopeId })
    .sort({ updatedAt: -1 })
    .skip(MAX_MEMORIES_PER_SCOPE)
    .select("_id")
    .lean();
  if (overflow.length > 0) {
    await Memory.deleteMany({ _id: { $in: overflow.map((memory) => memory._id) } });
  }
}

export async function getMemoryFacts(
  ownerId: string,
  scope: StoredMemoryScope,
  scopeId: string
): Promise<string[]> {
  const memories = await Memory.find({ ownerId, scope, scopeId })
    .sort({ updatedAt: -1 })
    .limit(20)
    .select("content")
    .lean();
  return memories.map((memory) => memory.content);
}

function containsSensitiveDetail(content: string): boolean {
  return (
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(content) ||
    /\b(?:\+?\d[\d().\s-]{7,}\d)\b/.test(content) ||
    /\b\d{1,6}\s+[A-Z0-9.'-]+\s+(street|st|road|rd|avenue|ave|boulevard|blvd|lane|ln|drive|dr)\b/i.test(content) ||
    /\b(live|lives|based)\s+(in|at)\b/i.test(content) ||
    /\b(password|passcode|api[ -]?key|access token|secret key|social security)\b/i.test(content) ||
    /\b(address|live at|lives at|home is|street|apartment|apt\.|zip code|postal code|health|medical|illness|disease|diagnos\w*|medication|therapy|therapist|politic\w*|religio\w*|sexual|orientation|race|ethnicity|immigration|citizenship|bank|income|salary|debt|credit card|financial|legal|lawyer|court)\b/i.test(
      content
    )
  );
}
