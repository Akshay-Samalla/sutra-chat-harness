import { APIConnectionTimeoutError, APIError } from "openai";

export interface ProviderFailure {
  message: string;
  requestId?: string;
  retryable: boolean;
  status?: number;
}

export class ProviderEmptyResponseError extends Error {
  constructor() {
    super("Provider completed without a text response.");
    this.name = "ProviderEmptyResponseError";
  }
}

export function describeProviderFailure(
  error: unknown,
  providerLabel: string,
  model: string,
  statusOverride?: number
): ProviderFailure {
  const apiError = error instanceof APIError ? error : null;
  const status = apiError?.status ?? statusOverride;
  const requestId = safeRequestId(apiError?.request_id);
  const modelReference = model ? ` for model "${model}"` : "";
  const prefix = `${providerLabel}${modelReference}`;

  if (error instanceof ProviderEmptyResponseError) {
    return {
      message: `${prefix}: the provider completed without returning text. Check that this model supports chat responses, then try another model.`,
      ...(requestId ? { requestId } : {}),
      retryable: false
    };
  }
  if (status === 401 || status === 403) {
    return {
      message: `${prefix}: the provider rejected the API key or the key cannot access this model. Check the saved key and account permissions.`,
      ...(requestId ? { requestId } : {}),
      retryable: false,
      status
    };
  }
  if (status === 402) {
    return {
      message: `${prefix}: the provider account has no available credits or billing is not enabled. Check its billing page.`,
      ...(requestId ? { requestId } : {}),
      retryable: false,
      status
    };
  }
  if (status === 404) {
    return {
      message: `${prefix}: that model or API endpoint was not found. Choose a model from the refreshed list and check the provider URL.`,
      ...(requestId ? { requestId } : {}),
      retryable: false,
      status
    };
  }
  if (status === 408 || status === 504 || error instanceof APIConnectionTimeoutError) {
    return {
      message: `${prefix}: the provider took too long to respond. Try again, or choose another model or provider.`,
      ...(requestId ? { requestId } : {}),
      retryable: true,
      ...(status ? { status } : {})
    };
  }
  if (status === 429) {
    return {
      message: `${prefix}: the provider is rate-limiting requests. Wait briefly, check your quota, or choose another model.`,
      ...(requestId ? { requestId } : {}),
      retryable: true,
      status
    };
  }
  if (status !== undefined && status >= 500) {
    return {
      message: `${prefix}: the provider is temporarily unavailable (HTTP ${status}). Try again shortly.`,
      ...(requestId ? { requestId } : {}),
      retryable: true,
      status
    };
  }
  if (status === 400 || status === 422) {
    return {
      message: `${prefix}: the provider rejected this request. Check the model and response parameters; some models do not support every setting.`,
      ...(requestId ? { requestId } : {}),
      retryable: false,
      status
    };
  }

  return {
    message: `${providerLabel}: Sutra could not connect to the provider. Check the endpoint and credentials, then try again.`,
    ...(requestId ? { requestId } : {}),
    retryable: true,
    ...(status ? { status } : {})
  };
}

function safeRequestId(requestId: string | null | undefined): string | undefined {
  if (!requestId || requestId.length > 128 || !/^[\w.-]+$/.test(requestId)) {
    return undefined;
  }
  return requestId;
}
