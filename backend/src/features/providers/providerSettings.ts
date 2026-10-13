import type {
  PersonaParameters,
  ProviderId,
  ProviderOption,
  ProviderSettingsDraft
} from "@sutra/shared";
import { ProviderConfig as ProviderConfigModel, type ProviderConfigDocument } from "../../models/ProviderConfig.js";
import { parsePersonaParameters } from "../../shared/validation.js";
import { decryptProviderToken } from "./providerSecrets.js";
import type { ProviderConnection } from "./providerClient.js";
import { getProviderDefaults } from "./providerClient.js";

export async function resolveProvider(
  ownerId: string,
  provider: ProviderId
): Promise<{
  option: ProviderOption;
  connection: ProviderConnection;
  settings: ProviderConfigDocument | null;
}> {
  const defaults = getProviderDefaults()[provider];
  const settings = await ProviderConfigModel.findOne({ ownerId, provider })
    .select("+apiTokenEncrypted");
  const apiToken = settings?.apiTokenEncrypted
    ? decryptProviderToken(settings.apiTokenEncrypted)
    : defaults.apiKey;
  const connection: ProviderConnection = {
    ...defaults,
    baseUrl: settings?.baseUrl ?? defaults.baseUrl,
    apiKey: apiToken
  };
  const option: ProviderOption = {
    id: provider,
    label: defaults.label,
    configured: provider === "openrouter" ? Boolean(apiToken) : true,
    hasApiToken: Boolean(settings?.apiTokenEncrypted),
    baseUrl: connection.baseUrl,
    defaultModel: settings?.defaultModel || defaults.defaultModel,
    defaultParams: { ...settings?.defaultParams },
    systemPromptOverride: settings?.systemPromptOverride ?? ""
  };
  return { option, connection, settings };
}

export function parseProviderId(value: string): ProviderId | null {
  return value === "openrouter" || value === "ollama" || value === "localai"
    ? value
    : null;
}

export function parseProviderSettings(input: unknown): ProviderSettingsDraft | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const body = input as Record<string, unknown>;
  const baseUrl = normalizeProviderUrl(body.baseUrl);
  const defaultModel =
    typeof body.defaultModel === "string" && body.defaultModel.trim().length <= 200
      ? body.defaultModel.trim()
      : null;
  const systemPromptOverride =
    typeof body.systemPromptOverride === "string" &&
    body.systemPromptOverride.trim().length <= 6000
      ? body.systemPromptOverride.trim()
      : null;
  const defaultParams = parsePersonaParameters(body.defaultParams);
  const apiToken =
    body.apiToken === undefined
      ? ""
      : typeof body.apiToken === "string" && body.apiToken.trim().length <= 10000
        ? body.apiToken.trim()
        : null;
  const clearApiToken = body.clearApiToken ?? false;

  if (
    !baseUrl ||
    defaultModel === null ||
    systemPromptOverride === null ||
    defaultParams === null ||
    apiToken === null ||
    typeof clearApiToken !== "boolean"
  ) {
    return null;
  }
  return { baseUrl, defaultModel, systemPromptOverride, defaultParams, apiToken, clearApiToken };
}

function normalizeProviderUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length > 500) {
    return null;
  }
  try {
    const url = new URL(value.trim());
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.hostname === "169.254.169.254" ||
      url.hostname === "metadata.google.internal"
    ) {
      return null;
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}
