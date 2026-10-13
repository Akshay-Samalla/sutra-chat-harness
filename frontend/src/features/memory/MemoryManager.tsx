import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { LongTermMemory, Persona } from "@sutra/shared";

interface MemoryManagerProps {
  personas: Persona[];
  onClose: () => void;
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error ?? `Request failed (${response.status}).`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export default function MemoryManager({ personas, onClose }: MemoryManagerProps) {
  const [enabled, setEnabled] = useState(true);
  const [memories, setMemories] = useState<LongTermMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    requestJson<{ enabled: boolean; memories: LongTermMemory[] }>("/api/memories")
      .then((result) => {
        if (!alive) return;
        setEnabled(result.enabled);
        setMemories(result.memories);
      })
      .catch((loadError: unknown) => {
        if (alive) setError(loadError instanceof Error ? loadError.message : "Could not load memory.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !working) onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, working]);

  const toggleMemory = async () => {
    setWorking(true);
    setError("");
    try {
      const result = await requestJson<{ enabled: boolean }>("/api/memories/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled })
      });
      setEnabled(result.enabled);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update memory settings.");
    } finally {
      setWorking(false);
    }
  };

  const forgetMemory = async (memory: LongTermMemory) => {
    setWorking(true);
    setError("");
    try {
      await requestJson<void>(`/api/memories/${memory.id}`, { method: "DELETE" });
      setMemories((current) => current.filter((item) => item.id !== memory.id));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not remove this memory.");
    } finally {
      setWorking(false);
    }
  };

  const forgetAll = async () => {
    if (!window.confirm("Forget every saved memory? Conversations stay intact, and automatic memory remains on for future messages.")) return;
    setWorking(true);
    setError("");
    try {
      await requestJson<void>("/api/memories", { method: "DELETE" });
      setMemories([]);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not clear saved memories.");
    } finally {
      setWorking(false);
    }
  };

  const scopeName = (memory: LongTermMemory) => {
    if (memory.scope === "user") return "Across personas";
    return personas.find((persona) => persona.id === memory.personaId)?.name ?? "A persona";
  };

  return (
    <AnimatePresence>
      <motion.div
        className="persona-modal-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget && !working) onClose();
        }}
      >
        <motion.section
          className="persona-modal memory-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="memory-manager-title"
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.99 }}
          transition={{ duration: 0.18 }}
        >
          <header className="persona-modal-header">
            <div>
              <h2 id="memory-manager-title">Things Sutra remembers</h2>
              <p>Review what carries from one conversation to the next.</p>
            </div>
            <button className="icon-button" onClick={onClose} aria-label="Close memory settings" disabled={working}>
              <X size={18} />
            </button>
          </header>

          <div className="memory-content">
            <section className="memory-control">
              <div>
                <strong>Automatic memory</strong>
                <p>
                  When on, Sutra sends a short follow-up request to your selected model after a reply.
                  It looks for details you stated directly and avoids sensitive information.
                </p>
              </div>
              <button
                className={`memory-toggle ${enabled ? "memory-toggle-on" : ""}`}
                type="button"
                role="switch"
                aria-checked={enabled}
                aria-label="Automatic memory"
                onClick={() => void toggleMemory()}
                disabled={working || loading}
              >
                {enabled ? "On" : "Off"}
              </button>
            </section>

            {error && <p className="persona-error memory-error" role="alert">{error}</p>}
            <div className="memory-list-heading">
              <h3>Saved memories</h3>
              {memories.length > 0 && (
                <button className="memory-forget-all" onClick={() => void forgetAll()} disabled={working}>
                  Forget all
                </button>
              )}
            </div>

            {loading ? (
              <p className="memory-empty">Loading saved memories…</p>
            ) : memories.length === 0 ? (
              <div className="memory-empty">
                <Bookmark size={19} aria-hidden="true" />
                <p>{enabled ? "Nothing saved yet. Sutra will keep only details worth carrying forward." : "Memory is off and there are no saved details."}</p>
              </div>
            ) : (
              <ul className="memory-list">
                {memories.map((memory) => (
                  <li key={memory.id} className="memory-row">
                    <div className="memory-row-copy">
                      <span>{scopeName(memory)}</span>
                      <p>{memory.content}</p>
                      <time dateTime={memory.updatedAt}>
                        Updated {new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(memory.updatedAt))}
                      </time>
                    </div>
                    <button
                      className="memory-forget-button"
                      onClick={() => void forgetMemory(memory)}
                      aria-label={`Forget memory: ${memory.content}`}
                      disabled={working}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="memory-footnote">
              Your saved memories stay in your Sutra account. Each reply may use one extra short request
              to your selected provider while automatic memory is on.
            </p>
          </div>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
