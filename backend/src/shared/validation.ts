import type { PersonaParameters } from "@sutra/shared";

export function parsePersonaParameters(input: unknown): PersonaParameters | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const params = input as Record<string, unknown>;
  const parameterRules: Record<keyof PersonaParameters, [number, number]> = {
    temperature: [0, 2],
    topP: [0, 1],
    topK: [1, 500],
    maxTokens: [1, 200000],
    frequencyPenalty: [-2, 2],
    presencePenalty: [-2, 2]
  };
  const defaultParams: PersonaParameters = {};
  for (const [key, range] of Object.entries(parameterRules) as Array<
    [keyof PersonaParameters, [number, number]]
  >) {
    const value = params[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      value < range[0] ||
      value > range[1]
    ) {
      return null;
    }
    defaultParams[key] = value;
  }
  return defaultParams;
}
