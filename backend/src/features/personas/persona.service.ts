import mongoose from "mongoose";
import type { Persona, PersonaDraft } from "@sutra/shared";
import { starterPersonas } from "@sutra/shared";
import { Persona as PersonaModel, type PersonaDocument } from "../../models/Persona.js";
import { parsePersonaParameters } from "../../shared/validation.js";

export { starterPersonas };

export function serializePersona(persona: PersonaDocument): Persona {
  return {
    id: String(persona._id),
    name: persona.name,
    avatar: persona.avatar,
    description: persona.description,
    systemPrompt: persona.systemPrompt,
    defaultModel: persona.defaultModel,
    defaultParams: { ...persona.defaultParams },
    memoryScope: persona.memoryScope,
    allowedTools: [...persona.allowedTools],
    isStarter: Boolean(persona.starterKey)
  };
}

export async function findPersonaForOwner(
  ownerId: string,
  personaId: string
): Promise<PersonaDocument | null> {
  if (!mongoose.isValidObjectId(personaId)) return null;
  return PersonaModel.findOne({ _id: personaId, ownerId, deletedAt: null });
}

export function parsePersonaDraft(input: unknown): PersonaDraft | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const name = readText(body.name, 40);
  const avatar = readText(body.avatar, 8);
  const description = readText(body.description, 120);
  const systemPrompt = readText(body.systemPrompt, 6000);
  const defaultModel =
    typeof body.defaultModel === "string" && body.defaultModel.trim().length <= 200
      ? body.defaultModel.trim()
      : null;
  const memoryScope = body.memoryScope;
  const rawTools = body.allowedTools;
  const defaultParams = parsePersonaParameters(body.defaultParams);

  if (
    !name ||
    !avatar ||
    !description ||
    !systemPrompt ||
    defaultModel === null ||
    !["conversation", "user", "persona"].includes(String(memoryScope)) ||
    !Array.isArray(rawTools) ||
    rawTools.length > 20 ||
    rawTools.some((tool) => typeof tool !== "string" || tool.trim().length > 80) ||
    defaultParams === null
  ) {
    return null;
  }

  return {
    name,
    avatar,
    description,
    systemPrompt,
    defaultModel,
    defaultParams,
    memoryScope: memoryScope as PersonaDraft["memoryScope"],
    allowedTools: [...new Set(rawTools.map((tool) => (tool as string).trim()).filter(Boolean))]
  };
}

function readText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}
