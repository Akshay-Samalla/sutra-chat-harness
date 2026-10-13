import assert from "node:assert/strict";
import { test } from "node:test";
import { APIError, APIConnectionTimeoutError } from "openai";
import { describeProviderFailure, ProviderEmptyResponseError } from "./providerErrors.js";

function apiError(status: number, requestId = "req-sutra-123"): APIError {
  return new APIError(status, {}, "Provider response contained sensitive details", {
    "x-request-id": requestId
  });
}

test("provider failures explain common account and model errors without echoing provider payloads", () => {
  const cases = [
    [401, /rejected the API key/],
    [402, /no available credits/],
    [404, /model or API endpoint was not found/],
    [429, /rate-limiting requests/],
    [503, /temporarily unavailable \(HTTP 503\)/]
  ] as const;

  for (const [status, expectedMessage] of cases) {
    const failure = describeProviderFailure(apiError(status), "OpenRouter", "vendor/model");
    assert.match(failure.message, expectedMessage);
    assert.equal(failure.requestId, "req-sutra-123");
    assert.equal(failure.message.includes("sensitive details"), false);
  }
});

test("provider failures identify connection timeouts and reject unsafe request IDs", () => {
  const timeout = describeProviderFailure(
    new APIConnectionTimeoutError(),
    "Ollama",
    "llama3.2"
  );
  assert.equal(timeout.retryable, true);
  assert.match(timeout.message, /too long to respond/);

  const unsafeId = describeProviderFailure(apiError(401, "token=secret"), "OpenRouter", "model");
  assert.equal(unsafeId.requestId, undefined);
});

test("empty provider completions produce an actionable model-selection error", () => {
  const failure = describeProviderFailure(
    new ProviderEmptyResponseError(),
    "OpenRouter",
    "vendor/model"
  );
  assert.match(failure.message, /completed without returning text/);
  assert.equal(failure.retryable, false);
});
