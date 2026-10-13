import OpenAI from "openai";
import type {
  ProviderId,
  ProviderModel,
  ProviderOption
} from "@sutra/shared";

export interface ProviderConnection {
  id: ProviderId;
  label: string;
  baseUrl: string;
  apiKey?: string;
  defaultModel: string;
}

export function getProviderDefaults(): Record<ProviderId, ProviderConnection> {
  return {
    openrouter: {
      id: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: process.env.OPENROUTER_API_KEY,
      defaultModel: process.env.OPENROUTER_DEFAULT_MODEL ?? "openai/gpt-4o-mini"
    },
    ollama: {
      id: "ollama",
      label: "Ollama",
      baseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
      apiKey: process.env.OLLAMA_API_KEY ?? "ollama",
      defaultModel: process.env.OLLAMA_DEFAULT_MODEL ?? "llama3.2"
    },
    localai: {
      id: "localai",
      label: "LocalAI",
      baseUrl: process.env.LOCALAI_BASE_URL ?? "http://localhost:8080/v1",
      apiKey: process.env.LOCALAI_API_KEY ?? "localai",
      defaultModel: process.env.LOCALAI_DEFAULT_MODEL ?? "gpt-4o-mini"
    }
  };
}

export function createProviderClient(
  provider: ProviderId,
  override?: Partial<ProviderConnection>
): OpenAI {
  const config = { ...getProviderDefaults()[provider], ...override };
  if (!config) {
    throw new Error("Choose a supported model provider.");
  }
  if (provider === "openrouter" && !config.apiKey) {
    throw new Error("Add OPENROUTER_API_KEY to the backend environment to use OpenRouter.");
  }

  const defaultHeaders =
    provider === "openrouter"
      ? { "X-Title": "Sutra" }
      : undefined;

  return new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
    defaultHeaders
  });
}

export function getDefaultModel(provider: ProviderId): string {
  return getProviderDefaults()[provider].defaultModel;
}

export async function fetchProviderModels(
  config: ProviderConnection
): Promise<ProviderModel[]> {
  const url = new URL("models", `${config.baseUrl.replace(/\/+$/, "")}/`);
  const headers = new Headers({ Accept: "application/json" });
  if (config.apiKey) {
    headers.set("Authorization", `Bearer ${config.apiKey}`);
  }

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) {
    throw new Error(`Provider returned HTTP ${response.status} while listing models.`);
  }

  const payload: unknown = await response.json();
  if (
    !payload ||
    typeof payload !== "object" ||
    !("data" in payload) ||
    !Array.isArray(payload.data)
  ) {
    throw new Error("Provider returned an unexpected model list.");
  }

  return payload.data
    .filter(
      (model): model is Record<string, unknown> =>
        Boolean(model) && typeof model === "object" && "id" in model && typeof model.id === "string"
    )
    .slice(0, 500)
    .map((model) => {
      const pricing = model.pricing;
      const pricingRecord =
        pricing && typeof pricing === "object" ? pricing as Record<string, unknown> : null;
      const promptPrice = pricingRecord?.prompt;
      const completionPrice = pricingRecord?.completion;
      return {
        id: model.id as string,
        name: typeof model.name === "string" ? model.name : model.id as string,
        ...(typeof promptPrice === "string" && typeof completionPrice === "string"
          ? { pricing: { prompt: promptPrice, completion: completionPrice } }
          : {})
      };
    });
}
