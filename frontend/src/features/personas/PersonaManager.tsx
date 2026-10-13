import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, Plus, Sparkles, Trash2, X } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import type { Persona, PersonaDraft, PersonaMemoryScope } from "@sutra/shared";

interface PersonaManagerProps {
  personas: Persona[];
  selectedPersonaId: string | null;
  onSelect: (personaId: string | null) => Promise<void>;
  onSave: (draft: PersonaDraft, personaId: string | null) => Promise<Persona>;
  onDelete: (persona: Persona) => Promise<void>;
  onClose: () => void;
}

interface PersonaForm extends Omit<PersonaDraft, "allowedTools"> {
  allowedToolsText: string;
}

const emptyForm: PersonaForm = {
  name: "",
  avatar: "मि",
  description: "",
  systemPrompt: "",
  defaultModel: "",
  defaultParams: { temperature: 0.7 },
  memoryScope: "persona",
  allowedToolsText: ""
};

function formFromPersona(persona: Persona): PersonaForm {
  return {
    name: persona.name,
    avatar: persona.avatar,
    description: persona.description,
    systemPrompt: persona.systemPrompt,
    defaultModel: persona.defaultModel,
    defaultParams: { ...persona.defaultParams },
    memoryScope: persona.memoryScope,
    allowedToolsText: persona.allowedTools.join(", ")
  };
}

export default function PersonaManager({
  personas,
  selectedPersonaId,
  onSelect,
  onSave,
  onDelete,
  onClose
}: PersonaManagerProps) {
  const [focusedId, setFocusedId] = useState<string | null>(selectedPersonaId);
  const [form, setForm] = useState<PersonaForm>(emptyForm);
  const [editing, setEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  const focusedPersona = personas.find((persona) => persona.id === focusedId) ?? null;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving && !working) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving, working]);

  const startCreate = () => {
    setFocusedId(null);
    setEditingId(null);
    setForm(emptyForm);
    setEditing(true);
    setError("");
  };

  const startEdit = (persona: Persona) => {
    setFocusedId(persona.id);
    setEditingId(persona.id);
    setForm(formFromPersona(persona));
    setEditing(true);
    setError("");
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const persona = await onSave(
        {
          ...form,
          allowedTools: [...new Set(form.allowedToolsText.split(",").map((tool) => tool.trim()).filter(Boolean))]
        },
        editingId
      );
      setFocusedId(persona.id);
      setEditing(false);
      setEditingId(persona.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this persona.");
    } finally {
      setSaving(false);
    }
  };

  const handleSelect = async (personaId: string | null) => {
    setWorking(true);
    setError("");
    try {
      await onSelect(personaId);
      setFocusedId(personaId);
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : "Could not switch persona.");
    } finally {
      setWorking(false);
    }
  };

  const handleDelete = async (persona: Persona) => {
    if (!window.confirm(`Delete ${persona.name}? Existing conversations will return to Sutra's default voice.`)) return;
    setWorking(true);
    setError("");
    try {
      await onDelete(persona);
      if (editingId === persona.id) setEditing(false);
      setFocusedId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this persona.");
    } finally {
      setWorking(false);
    }
  };

  const setParam = (key: keyof PersonaDraft["defaultParams"], value: string) => {
    setForm((current) => {
      const defaultParams = { ...current.defaultParams };
      if (value === "") delete defaultParams[key];
      else defaultParams[key] = Number(value);
      return { ...current, defaultParams };
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        className="persona-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving && !working) onClose();
        }}
      >
        <motion.section
          className="persona-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="persona-manager-title"
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          transition={{ duration: 0.18 }}
        >
          <header className="persona-modal-header">
            <div>
              <h2 id="persona-manager-title">Your conversation styles</h2>
              <p>Choose a voice for this chat, or shape one of your own.</p>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="Close persona settings" disabled={saving || working}><X size={18} /></button>
          </header>

          <div className="persona-modal-content">
            <nav className="persona-picker-list" aria-label="Available personas">
              <button
                className={`persona-choice ${selectedPersonaId === null ? "persona-choice-active" : ""}`}
                onClick={() => void handleSelect(null)}
                disabled={working || saving}
              >
                <span className="persona-avatar">सू</span>
                <span className="persona-choice-copy"><strong>Sutra</strong><small>Friendly, clear, and neutral</small></span>
                {selectedPersonaId === null && <Check className="persona-choice-check" size={15} />}
              </button>
              {personas.map((persona) => (
                <div className={`persona-choice-wrap ${focusedId === persona.id ? "persona-choice-wrap-focused" : ""}`} key={persona.id}>
                  <button
                    className={`persona-choice ${selectedPersonaId === persona.id ? "persona-choice-active" : ""}`}
                    onClick={() => { setFocusedId(persona.id); setEditing(false); void handleSelect(persona.id); }}
                    disabled={working || saving}
                  >
                    <span className="persona-avatar">{persona.avatar}</span>
                    <span className="persona-choice-copy"><strong>{persona.name}</strong><small>{persona.description}</small></span>
                    {selectedPersonaId === persona.id && <Check className="persona-choice-check" size={15} />}
                  </button>
                  {focusedId === persona.id && !editing && (
                    <div className="persona-choice-actions">
                      <button onClick={() => startEdit(persona)} disabled={working} aria-label={`Edit ${persona.name}`}><Pencil size={13} /> Edit</button>
                      <button onClick={() => void handleDelete(persona)} disabled={working} aria-label={`Delete ${persona.name}`}><Trash2 size={13} /> Delete</button>
                    </div>
                  )}
                </div>
              ))}
              <button className="persona-create-button" onClick={startCreate} disabled={saving || working}>
                <Plus size={15} /> Create a persona
              </button>
            </nav>

            <div className="persona-editor">
              {editing ? (
                <form className="persona-form" onSubmit={(event) => void handleSave(event)}>
                  <div className="persona-form-heading">
                    <span className="persona-form-avatar">{form.avatar || "सू"}</span>
                    <div><h3>{editingId ? "Edit persona" : "Create a persona"}</h3><p>Give this conversation style a clear point of view.</p></div>
                  </div>
                  <div className="persona-form-grid">
                    <label>Name<input required maxLength={40} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Anvesha" /></label>
                    <label>Avatar<input required maxLength={8} value={form.avatar} onChange={(event) => setForm({ ...form, avatar: event.target.value })} /></label>
                  </div>
                  <label>Description<input required maxLength={120} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What this voice is useful for" /></label>
                  <label>Instructions<textarea required maxLength={6000} rows={5} value={form.systemPrompt} onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })} placeholder="How should this persona respond?" /></label>
                  <div className="persona-form-grid">
                    <label>Default model<input maxLength={200} value={form.defaultModel} onChange={(event) => setForm({ ...form, defaultModel: event.target.value })} placeholder="Use the chat's model" /></label>
                    <label>Memory scope<select value={form.memoryScope} onChange={(event) => setForm({ ...form, memoryScope: event.target.value as PersonaMemoryScope })}><option value="persona">This persona</option><option value="conversation">This conversation</option><option value="user">Across personas</option></select></label>
                  </div>
                  <label>Allowed tools<input value={form.allowedToolsText} onChange={(event) => setForm({ ...form, allowedToolsText: event.target.value })} placeholder="Comma-separated; leave empty for none" /></label>
                  <details className="persona-advanced-settings">
                    <summary>Model parameters</summary>
                    <div className="persona-param-grid">
                      <label>Temperature<input type="number" min="0" max="2" step="0.05" value={form.defaultParams.temperature ?? ""} onChange={(event) => setParam("temperature", event.target.value)} /></label>
                      <label>Top P<input type="number" min="0" max="1" step="0.05" value={form.defaultParams.topP ?? ""} onChange={(event) => setParam("topP", event.target.value)} /></label>
                      <label>Top K<input type="number" min="1" max="500" value={form.defaultParams.topK ?? ""} onChange={(event) => setParam("topK", event.target.value)} /></label>
                      <label>Max tokens<input type="number" min="1" max="200000" value={form.defaultParams.maxTokens ?? ""} onChange={(event) => setParam("maxTokens", event.target.value)} /></label>
                      <label>Frequency penalty<input type="number" min="-2" max="2" step="0.1" value={form.defaultParams.frequencyPenalty ?? ""} onChange={(event) => setParam("frequencyPenalty", event.target.value)} /></label>
                      <label>Presence penalty<input type="number" min="-2" max="2" step="0.1" value={form.defaultParams.presencePenalty ?? ""} onChange={(event) => setParam("presencePenalty", event.target.value)} /></label>
                    </div>
                  </details>
                  {error && <p className="persona-error" role="alert">{error}</p>}
                  <div className="persona-form-actions">
                    <button type="button" className="persona-cancel-button" onClick={() => { setEditing(false); setError(""); }}>Cancel</button>
                    <button type="submit" className="persona-save-button" disabled={saving}>{saving ? "Saving…" : "Save persona"}</button>
                  </div>
                </form>
              ) : focusedPersona ? (
                <div className="persona-preview">
                  <span className="persona-preview-avatar">{focusedPersona.avatar}</span>
                  <h3>{focusedPersona.name}</h3>
                  <p className="persona-preview-description">{focusedPersona.description}</p>
                  <div className="persona-preview-detail"><span>Instructions</span><p>{focusedPersona.systemPrompt}</p></div>
                  <div className="persona-preview-meta">
                    <span>{focusedPersona.memoryScope === "persona" ? "Memory stays with this persona" : focusedPersona.memoryScope === "user" ? "Memory shared across personas" : "Memory stays in this chat"}</span>
                    {focusedPersona.isStarter && <span className="starter-note"><Sparkles size={12} /> Starter persona</span>}
                  </div>
                  {error && <p className="persona-error" role="alert">{error}</p>}
                </div>
              ) : (
                <div className="persona-preview persona-preview-neutral">
                  <span className="persona-preview-avatar">सू</span>
                  <h3>Sutra</h3>
                  <p className="persona-preview-description">Friendly, clear, and neutral. A good voice for everyday questions.</p>
                  <p className="neutral-note">Select one of the starter voices, or make a style that feels right to you.</p>
                  {error && <p className="persona-error" role="alert">{error}</p>}
                </div>
              )}
            </div>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
