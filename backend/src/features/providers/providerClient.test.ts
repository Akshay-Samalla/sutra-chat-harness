import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProviderConnection } from "./providerClient.js";
import { fetchProviderModels } from "./providerClient.js";

test("provider model discovery parses IDs and pricing without exposing credentials", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  let authorization = "";
  globalThis.fetch = async (input, init) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get("Authorization") ?? "";
    return Response.json({
      data: [
        {
          id: "openai/gpt-test",
          name: "GPT Test",
          pricing: { prompt: "0.000001", completion: "0.000002" }
        },
        { name: "Invalid model without an ID" },
        { id: "local/custom-model" }
      ]
    });
  };

  try {
    const connection: ProviderConnection = {
      id: "openrouter",
      label: "OpenRouter",
      baseUrl: "https://provider.example/v1",
      apiKey: "synthetic-test-key",
      defaultModel: "openai/gpt-test"
    };
    const models = await fetchProviderModels(connection);

    assert.equal(requestedUrl, "https://provider.example/v1/models");
    assert.equal(authorization, "Bearer synthetic-test-key");
    assert.deepEqual(models, [
      {
        id: "openai/gpt-test",
        name: "GPT Test",
        pricing: { prompt: "0.000001", completion: "0.000002" }
      },
      { id: "local/custom-model", name: "local/custom-model" }
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
