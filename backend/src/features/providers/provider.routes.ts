import { randomUUID } from "node:crypto";
import { Router } from "express";
import { ProviderConfig as ProviderConfigModel } from "../../models/ProviderConfig.js";
import { encryptProviderToken } from "./providerSecrets.js";
import { fetchProviderModels } from "./providerClient.js";
import { describeProviderFailure } from "./providerErrors.js";
import {
  parseProviderId,
  parseProviderSettings,
  resolveProvider
} from "./providerSettings.js";

const providerRouter = Router();

providerRouter.get("/", async (_req, res, next) => {
  try {
    const ownerId = res.locals.ownerId as string;
    const providers = await Promise.all(
      (["openrouter", "ollama", "localai"] as const).map(async (provider) =>
        (await resolveProvider(ownerId, provider)).option
      )
    );
    res.json({ providers });
  } catch (error) {
    next(error);
  }
});

providerRouter.put("/:providerId", async (req, res, next) => {
  const providerId = parseProviderId(req.params.providerId);
  if (!providerId) {
    res.status(404).json({ error: "Choose a supported provider." });
    return;
  }
  const draft = parseProviderSettings(req.body);
  if (!draft) {
    res.status(400).json({ error: "Check the endpoint, model settings, and prompt override." });
    return;
  }
  if (draft.apiToken && draft.clearApiToken) {
    res.status(400).json({ error: "Enter a key or clear the saved key, not both." });
    return;
  }

  try {
    const ownerId = res.locals.ownerId as string;
    const current = await ProviderConfigModel.findOne({ ownerId, provider: providerId })
      .select("+apiTokenEncrypted");
    let encryptedToken = current?.apiTokenEncrypted ?? null;

    if (draft.clearApiToken) {
      encryptedToken = null;
    } else if (draft.apiToken) {
      try {
        encryptedToken = encryptProviderToken(draft.apiToken);
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Set TOKEN_ENCRYPTION_KEY")) {
          res.status(503).json({ error: error.message });
          return;
        }
        throw error;
      }
    }

    await ProviderConfigModel.findOneAndUpdate(
      { ownerId, provider: providerId },
      {
        $set: {
          ownerId,
          provider: providerId,
          baseUrl: draft.baseUrl,
          apiTokenEncrypted: encryptedToken,
          defaultModel: draft.defaultModel,
          defaultParams: draft.defaultParams,
          systemPromptOverride: draft.systemPromptOverride
        }
      },
      { upsert: true, new: true, runValidators: true }
    );
    const resolved = await resolveProvider(ownerId, providerId);
    res.json({ provider: resolved.option });
  } catch (error) {
    next(error);
  }
});

providerRouter.get("/:providerId/models", async (req, res) => {
  const providerId = parseProviderId(req.params.providerId);
  if (!providerId) {
    res.status(404).json({ error: "Choose a supported provider." });
    return;
  }

  const ownerId = res.locals.ownerId as string;
  let providerLabel: string = providerId;
  try {
    const { connection, option } = await resolveProvider(ownerId, providerId);
    providerLabel = option.label;
    const models = await fetchProviderModels(connection);
    res.json({ models });
  } catch (error) {
    const status = providerStatusFromError(error);
    const failure = describeProviderFailure(error, providerLabel, "", status);
    const requestId = failure.requestId ?? randomUUID();
    console.error("Provider model discovery failed", {
      provider: providerId,
      status: failure.status,
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError"
    });
    res.status(failure.status ?? 502).json({
      error: failure.message,
      requestId,
      retryable: failure.retryable
    });
  }
});

function providerStatusFromError(error: unknown): number | undefined {
  if (!(error instanceof Error)) return undefined;
  const status = /HTTP (\d{3})/.exec(error.message)?.[1];
  return status ? Number(status) : undefined;
}

export default providerRouter;
