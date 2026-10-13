import { AnimatePresence, motion } from "framer-motion";
import { Check, RefreshCw, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type {
  PersonaParameters,
  ProviderId,
  ProviderModel,
  ProviderOption,
  ProviderSettingsDraft
} from "@sutra/shared";

interface ModelPickerProps {
  providers: ProviderOption[];
  activeProviderId: ProviderId;
  activeModel: string;
  onSave: (providerId: ProviderId, settings: ProviderSettingsDraft) => Promise<ProviderOption>;
  onUse: (providerId: ProviderId, model: string) => void;
  onClose: () => void;
}

type ModelForm = ProviderSettingsDraft;

function formFromProvider(provider: ProviderOption): ModelForm {
  return {
    baseUrl: provider.baseUrl,
    apiToken: "",
    clearApiToken: false,
    defaultModel: provider.defaultModel,
    defaultParams: { ...provider.defaultParams },
    systemPromptOverride: provider.systemPromptOverride
  };
}

function pricePerMillion(price: string): string {
  const value = Number(price);
  return Number.isFinite(value) ? `$${(value * 1_000_000).toFixed(2)}` : "";
}

function ModelCatalogue({
  models,
  selectedModel,
  loading,
  error,
  onSelect
}: {
  models: ProviderModel[];
  selectedModel: string;
  loading: boolean;
  error: string;
  onSelect: (model: string) => void;
}) {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const filteredModels = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const matches = needle
      ? models.filter((model) =>
          `${model.name} ${model.id}`.toLocaleLowerCase().includes(needle)
        )
      : models;
    return matches.slice(0, 80);
  }, [models, query]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  return (
    <section className="model-catalogue" aria-labelledby="model-catalogue-title">
      <div className="model-catalogue-heading">
        <div>
          <h4 id="model-catalogue-title">Available models</h4>
          <p>{loading ? "Loading the provider catalogue…" : error || `${models.length} models`}</p>
        </div>
        <label className="model-search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or ID"
            aria-label="Search available models"
          />
        </label>
      </div>
      <div className="model-catalogue-list" aria-label="Available models">
        {filteredModels.map((model) => (
          <button
            key={model.id}
            type="button"
            aria-pressed={selectedModel === model.id}
            className={`model-catalogue-option ${selectedModel === model.id ? "model-catalogue-option-selected" : ""}`}
            onClick={() => onSelect(model.id)}
          >
            <span className="model-catalogue-option-copy">
              <strong>{model.name}</strong>
              <small>{model.id}</small>
            </span>
            {model.pricing && (
              <span className="model-pricing">
                <small>in {pricePerMillion(model.pricing.prompt)}</small>
                <small>out {pricePerMillion(model.pricing.completion)}</small>
              </span>
            )}
            {selectedModel === model.id && <Check size={15} aria-label="Selected" />}
          </button>
        ))}
        {!loading && models.length > 0 && filteredModels.length === 0 && (
          <p className="model-catalogue-empty">No listed models match that search. You can still enter a model ID below.</p>
        )}
        {!loading && models.length === 0 && !error && (
          <p className="model-catalogue-empty">The provider did not return a model list. Enter a model ID below.</p>
        )}
      </div>
      {filteredModels.length >= 80 && (
        <p className="model-catalogue-footnote">Showing the first 80 matches. Narrow your search to see more.</p>
      )}
    </section>
  );
}

export default function ModelPicker({
  providers,
  activeProviderId,
  activeModel,
  onSave,
  onUse,
  onClose
}: ModelPickerProps) {
  const initialProvider = providers.find((provider) => provider.id === activeProviderId) ?? providers[0];
  const [providerId, setProviderId] = useState<ProviderId>(initialProvider?.id ?? "openrouter");
  const [form, setForm] = useState<ModelForm>(initialProvider ? formFromProvider(initialProvider) : {
    baseUrl: "",
    apiToken: "",
    clearApiToken: false,
    defaultModel: activeModel,
    defaultParams: {},
    systemPromptOverride: ""
  });
  const [models, setModels] = useState<ProviderModel[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [modelLoadError, setModelLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [discardTarget, setDiscardTarget] = useState<ProviderId | null>(null);
  const provider = providers.find((item) => item.id === providerId) ?? initialProvider;
  const refreshModels = useCallback(async (signal?: AbortSignal) => {
    setModels([]);
    setModelLoadError("");
    setLoadingModels(true);
    try {
      const response = await fetch(`/api/providers/${providerId}/models`, { signal });
      const result = (await response.json()) as { models?: ProviderModel[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? `Model list request failed (${response.status}).`);
      setModels(result.models ?? []);
    } catch (requestError) {
      if (!signal?.aborted) {
        setModelLoadError(requestError instanceof Error ? requestError.message : "Could not load models.");
      }
    } finally {
      if (!signal?.aborted) setLoadingModels(false);
    }
  }, [providerId]);

  const isDirty = Boolean(provider) && (
    form.baseUrl !== provider.baseUrl ||
    form.defaultModel !== provider.defaultModel ||
    JSON.stringify(form.defaultParams) !== JSON.stringify(provider.defaultParams) ||
    form.systemPromptOverride !== provider.systemPromptOverride ||
    Boolean(form.apiToken) ||
    form.clearApiToken
  );
  const connectionDirty = Boolean(provider) && (
    form.baseUrl !== provider.baseUrl ||
    Boolean(form.apiToken) ||
    form.clearApiToken
  );
  const nonModelSettingsDirty = Boolean(provider) && (
    form.baseUrl !== provider.baseUrl ||
    JSON.stringify(form.defaultParams) !== JSON.stringify(provider.defaultParams) ||
    form.systemPromptOverride !== provider.systemPromptOverride ||
    Boolean(form.apiToken) ||
    form.clearApiToken
  );

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  useEffect(() => {
    const controller = new AbortController();
    setNotice("");
    void refreshModels(controller.signal);
    return () => controller.abort();
  }, [refreshModels]);

  const switchProvider = (nextProviderId: ProviderId) => {
    if (nextProviderId === providerId) return;
    if (isDirty) {
      setDiscardTarget(nextProviderId);
      return;
    }
    commitProviderSwitch(nextProviderId);
  };

  const commitProviderSwitch = (nextProviderId: ProviderId) => {
    const nextProvider = providers.find((item) => item.id === nextProviderId);
    if (!nextProvider) return;
    setProviderId(nextProviderId);
    setForm(formFromProvider(nextProvider));
    setDiscardTarget(null);
    setError("");
    setNotice("");
  };

  const setParam = (key: keyof PersonaParameters, value: string) => {
    setForm((current) => {
      const defaultParams = { ...current.defaultParams };
      if (value === "") delete defaultParams[key];
      else defaultParams[key] = Number(value);
      return { ...current, defaultParams };
    });
  };

  const saveSettings = async () => {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const saved = await onSave(providerId, form);
      setForm(formFromProvider(saved));
      setNotice("Provider settings saved.");
      if (connectionDirty) void refreshModels();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save provider settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        className="persona-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) onClose();
        }}
      >
        <motion.section
          className="model-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="model-picker-title"
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          transition={{ duration: 0.18 }}
        >
          <header className="persona-modal-header">
            <div>
              <h2 id="model-picker-title">Model settings</h2>
              <p>Choose a provider, then set the model and how it responds.</p>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="Close model settings" disabled={saving}><X size={18} /></button>
          </header>
          <div className="model-modal-content">
            <nav className="model-provider-list" aria-label="Model providers">
              {providers.map((item) => (
                <button key={item.id} className={`model-provider-choice ${providerId === item.id ? "model-provider-choice-active" : ""}`} onClick={() => switchProvider(item.id)}>
                  <span className="provider-status-dot" data-ready={item.configured} />
                  <span><strong>{item.label}</strong><small>{item.hasApiToken ? "Personal key saved" : item.id === "openrouter" ? item.configured ? "Server key available" : "Add a key" : "Default endpoint"}</small></span>
                  {providerId === item.id && <Check size={14} />}
                </button>
              ))}
              <p className="provider-secret-note">Provider keys stay on the server and are never returned to this page.</p>
            </nav>
            <form className="model-settings-form" onSubmit={(event) => { event.preventDefault(); void saveSettings(); }}>
              <div className="model-form-heading">
                <div><h3>{provider?.label ?? "Provider"}</h3><p>Changes apply to your account only.</p></div>
                <button type="button" className="refresh-models-button" onClick={() => void refreshModels()} disabled={loadingModels || connectionDirty} aria-label="Refresh model list">
                  <RefreshCw size={14} className={loadingModels ? "refresh-spinning" : ""} />
                  <span>{connectionDirty ? "Save endpoint/key first" : loadingModels ? "Loading models" : "Refresh models"}</span>
                </button>
              </div>
              {discardTarget && <div className="provider-discard-note" role="status">
                <span>Unsaved changes will be discarded.</span>
                <button type="button" onClick={() => commitProviderSwitch(discardTarget)}>Discard and switch</button>
                <button type="button" onClick={() => setDiscardTarget(null)}>Keep editing</button>
              </div>}
              {connectionDirty && <p className="model-list-count">Save the endpoint or key before refreshing models.</p>}

              <label className="model-field">Base URL
                <input required maxLength={500} value={form.baseUrl} onChange={(event) => setForm({ ...form, baseUrl: event.target.value })} placeholder="https://provider.example/v1" />
              </label>
              <label className="model-field">API key
                <input type="password" autoComplete="new-password" maxLength={10000} value={form.apiToken} onChange={(event) => setForm({ ...form, apiToken: event.target.value, clearApiToken: false })} placeholder={provider?.hasApiToken ? "Saved securely — leave blank to keep it" : "Enter a key if this provider requires one"} />
              </label>
              {provider?.hasApiToken && <label className="clear-provider-key"><input type="checkbox" checked={form.clearApiToken} onChange={(event) => setForm({ ...form, clearApiToken: event.target.checked, apiToken: "" })} /> Remove the saved key</label>}

              <label className="model-field">Model ID
                <input required maxLength={200} value={form.defaultModel} onChange={(event) => setForm({ ...form, defaultModel: event.target.value })} placeholder="Type a model ID or select one from the catalogue" />
              </label>
              <ModelCatalogue
                models={models}
                selectedModel={form.defaultModel}
                loading={loadingModels}
                error={modelLoadError}
                onSelect={(selectedModel) => setForm((current) => ({ ...current, defaultModel: selectedModel }))}
              />

              <div className="model-parameter-section">
                <span>Response parameters</span>
                <div className="model-param-grid">
                  <label>Temperature<input type="number" min="0" max="2" step="0.05" value={form.defaultParams.temperature ?? ""} onChange={(event) => setParam("temperature", event.target.value)} /></label>
                  <label>Top P<input type="number" min="0" max="1" step="0.05" value={form.defaultParams.topP ?? ""} onChange={(event) => setParam("topP", event.target.value)} /></label>
                  <label>Top K<input type="number" min="1" max="500" value={form.defaultParams.topK ?? ""} onChange={(event) => setParam("topK", event.target.value)} /></label>
                  <label>Max tokens<input type="number" min="1" max="200000" value={form.defaultParams.maxTokens ?? ""} onChange={(event) => setParam("maxTokens", event.target.value)} /></label>
                  <label>Frequency penalty<input type="number" min="-2" max="2" step="0.1" value={form.defaultParams.frequencyPenalty ?? ""} onChange={(event) => setParam("frequencyPenalty", event.target.value)} /></label>
                  <label>Presence penalty<input type="number" min="-2" max="2" step="0.1" value={form.defaultParams.presencePenalty ?? ""} onChange={(event) => setParam("presencePenalty", event.target.value)} /></label>
                </div>
              </div>

              <label className="model-field">System prompt override
                <textarea rows={3} maxLength={6000} value={form.systemPromptOverride} onChange={(event) => setForm({ ...form, systemPromptOverride: event.target.value })} placeholder="Optional; used when a persona is not selected" />
              </label>
              <p className="model-credential-note">{provider?.hasApiToken ? "A saved key is encrypted at rest. Enter a new key to replace it." : "Keys are encrypted with the server's TOKEN_ENCRYPTION_KEY before storage."}</p>
              {error && <p className="persona-error" role="alert">{error}</p>}
              {notice && <p className="model-saved-note" role="status">{notice}</p>}
              <div className="persona-form-actions">
                <button type="button" className="persona-cancel-button" disabled={saving || nonModelSettingsDirty || !form.defaultModel.trim()} onClick={() => {
                  onUse(providerId, form.defaultModel);
                }}>Use in this chat</button>
                <button type="submit" className="persona-save-button" disabled={saving || !form.defaultModel.trim()}>{saving ? "Saving…" : "Save as default"}</button>
              </div>
            </form>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
