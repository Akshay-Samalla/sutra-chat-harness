import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  Command,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Settings2,
  Sparkles,
  X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage, ChatSummary, Persona, PersonaDraft, ProviderId, ProviderOption, ProviderSettingsDraft } from "@sutra/shared";
import MemoryManager from "../memory/MemoryManager";
import ModelPicker from "../providers/ModelPicker";
import PersonaManager from "../personas/PersonaManager";

interface ChatDetail {
  id: string;
  title: string;
  personaId: string | null;
  messages: ChatMessage[];
}

interface SessionResponse {
  authenticated: boolean;
  user: { id: string; name?: string; email: string } | null;
  googleLoginAvailable: boolean;
}

const starterPrompts = [
  { title: "Find the thread", detail: "Help me untangle a difficult idea" },
  { title: "Make a plan", detail: "Turn a loose goal into clear next steps" },
  { title: "Learn something", detail: "Explain a topic with care and clarity" },
  { title: "Shape a draft", detail: "Find the words for what I mean" }
];

async function readJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(result?.error ?? `Request failed (${response.status}).`);
  }
  return response.json() as Promise<T>;
}

export default function App() {
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChat, setActiveChat] = useState<ChatDetail | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);
  const [personaManagerOpen, setPersonaManagerOpen] = useState(false);
  const [memoryManagerOpen, setMemoryManagerOpen] = useState(false);
  const [modelPickerOpen, setModelPickerOpen] = useState(false);
  const [providerId, setProviderId] = useState<ProviderOption["id"]>("openrouter");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [memoryNotice, setMemoryNotice] = useState("");
  const [showTrace, setShowTrace] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshChats = useCallback(async () => {
    const result = await readJson<{ chats: ChatSummary[] }>("/api/chats");
    setChats(result.chats);
  }, []);

  const loadChat = useCallback(async (id: string) => {
    const result = await readJson<{ chat: ChatDetail }>(`/api/chats/${id}`);
    setActiveChat(result.chat);
    setSelectedPersonaId(result.chat.personaId ?? null);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      readJson<SessionResponse>("/api/session"),
      readJson<{ providers: ProviderOption[] }>("/api/providers").catch(() => ({ providers: [] }))
    ]).then(async ([currentSession, providerResponse]) => {
      if (!alive) return;
      setSession(currentSession);
      setProviders(providerResponse.providers);
      const configuredDefault =
        providerResponse.providers.find((provider) => provider.configured) ??
        providerResponse.providers[0];
      if (configuredDefault) {
        setProviderId(configuredDefault.id);
        setModel(configuredDefault.defaultModel);
      }
      if (currentSession.authenticated) {
        const [result, personaResult] = await Promise.all([
          readJson<{ chats: ChatSummary[] }>("/api/chats"),
          readJson<{ personas: Persona[] }>("/api/personas")
        ]);
        if (!alive) return;
        setChats(result.chats);
        setPersonas(personaResult.personas);
        if (result.chats[0]) {
          await loadChat(result.chats[0].id);
        }
      }
    }).catch((requestError: unknown) => {
      if (alive) setError(requestError instanceof Error ? requestError.message : "Could not connect to Sutra.");
    });
    return () => { alive = false; };
  }, [loadChat]);

  useEffect(() => {
    const activeProvider = providers.find((provider) => provider.id === providerId);
    if (activeProvider && !model) setModel(activeProvider.defaultModel);
  }, [model, providerId, providers]);

  useEffect(() => {
    const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId);
    if (selectedPersona?.defaultModel) setModel(selectedPersona.defaultModel);
  }, [personas, selectedPersonaId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeChat?.messages.length, activeChat?.messages.at(-1)?.content]);

  const createChat = async () => {
    setError("");
    setMemoryNotice("");
    try {
      const result = await readJson<{ chat: ChatDetail }>("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: selectedPersonaId })
      });
      setActiveChat(result.chat);
      setSelectedPersonaId(result.chat.personaId ?? null);
      await refreshChats();
      setSidebarOpen(false);
      textareaRef.current?.focus();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not start a conversation.");
    }
  };

  const savePersona = async (draft: PersonaDraft, personaId: string | null): Promise<Persona> => {
    const result = await readJson<{ persona: Persona }>(
      personaId ? `/api/personas/${personaId}` : "/api/personas",
      {
        method: personaId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      }
    );
    if (activeChat) {
      await readJson<{ personaId: string }>("/api/chats/" + activeChat.id + "/persona", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId: result.persona.id })
      });
      await refreshChats();
    }
    setPersonas((current) => personaId
      ? current.map((persona) => persona.id === result.persona.id ? result.persona : persona)
      : [...current, result.persona].sort((a, b) => Number(b.isStarter) - Number(a.isStarter) || a.name.localeCompare(b.name)));
    setSelectedPersonaId(result.persona.id);
    setActiveChat((current) => current ? { ...current, personaId: result.persona.id } : current);
    if (result.persona.defaultModel) setModel(result.persona.defaultModel);
    return result.persona;
  };

  const selectPersona = async (personaId: string | null) => {
    if (activeChat) {
      await readJson<{ personaId: string | null }>(`/api/chats/${activeChat.id}/persona`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personaId })
      });
      setActiveChat((current) => current && current.id === activeChat.id
        ? { ...current, personaId }
        : current);
      await refreshChats();
    }
    setSelectedPersonaId(personaId);
  };

  const deletePersona = async (persona: Persona) => {
    const response = await fetch(`/api/personas/${persona.id}`, { method: "DELETE" });
    if (!response.ok) {
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(result?.error ?? "Could not delete this persona.");
    }
    setPersonas((current) => current.filter((item) => item.id !== persona.id));
    if (selectedPersonaId === persona.id) {
      setSelectedPersonaId(null);
      setActiveChat((current) => current ? { ...current, personaId: null } : current);
    }
    await refreshChats();
  };

  const saveProviderSettings = async (id: ProviderId, settings: ProviderSettingsDraft): Promise<ProviderOption> => {
    const result = await readJson<{ provider: ProviderOption }>(`/api/providers/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings)
    });
    setProviders((current) => current.map((provider) => provider.id === id ? result.provider : provider));
    return result.provider;
  };

  const sendMessage = async (text = prompt) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setError("");
    setMemoryNotice("");
    setPrompt("");
    setBusy(true);
    let requestChatId: string | null = null;
    try {
      let chat = activeChat;
      if (!chat) {
        const created = await readJson<{ chat: ChatDetail }>("/api/chats", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ personaId: selectedPersonaId })
        });
        chat = created.chat;
        setActiveChat(chat);
      }
      requestChatId = chat.id;
      setActiveChat((current) => current
        ? { ...current, messages: [...current.messages, { role: "user", content: trimmed, createdAt: new Date().toISOString() }, { role: "assistant", content: "", createdAt: new Date().toISOString() }] }
        : current);

      const response = await fetch(`/api/chats/${chat.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: trimmed, provider: providerId, model, personaId: selectedPersonaId })
      });
      if (!response.ok || !response.body) {
        const responseError = (await response.json().catch(() => null)) as {
          error?: string;
          requestId?: string;
        } | null;
        const message = responseError?.error ?? "Could not start the response.";
        throw new Error(responseError?.requestId ? `${message} (Request ID: ${responseError.requestId})` : message);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventName = "";
      let assistantText = "";
      let completed = false;

      const handleEvent = (block: string) => {
        const lines = block.split("\n");
        eventName = "";
        for (const line of lines) {
          if (line.startsWith("event:")) eventName = line.slice(6).trim();
          if (!line.startsWith("data:")) continue;
          const data = JSON.parse(line.slice(5).trim()) as {
            text?: string;
            message?: string;
            error?: string;
            requestId?: string;
            status?: string;
          };
          if (eventName === "delta" && data.text) {
            assistantText += data.text;
            setActiveChat((current) => {
              if (!current || current.id !== chat?.id) return current;
              const messages = [...current.messages];
              const last = messages.at(-1);
              if (last?.role === "assistant") {
                messages[messages.length - 1] = { ...last, content: assistantText };
              }
              return { ...current, messages };
            });
          } else if (eventName === "error") {
            const details = data.message ?? data.error ?? "The provider could not complete this response.";
            throw new Error(data.requestId ? `${details} (Request ID: ${data.requestId})` : details);
          } else if (eventName === "done") {
            completed = true;
          } else if (eventName === "memory") {
            if (data.status === "saving") setMemoryNotice("Checking what to remember…");
            else if (data.status === "updated") setMemoryNotice("Sutra updated its saved memories.");
            else if (data.status === "unchanged") setMemoryNotice("No new details to remember.");
            else if (data.status === "disabled") setMemoryNotice("Memory is off.");
            else if (data.status === "changed") setMemoryNotice("Memory changed; this update was skipped.");
            else if (data.status === "failed") {
              setMemoryNotice("");
              const details = data.message ?? "Sutra couldn't update memory.";
              setError(data.requestId ? `${details} (Request ID: ${data.requestId})` : details);
            }
          }
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (block.trim()) handleEvent(block);
          boundary = buffer.indexOf("\n\n");
        }
        if (done) break;
      }
      if (buffer.trim()) handleEvent(buffer);
      if (!completed) throw new Error("The response stream ended before the provider completed. Your message is still here; try sending it again.");
      await refreshChats();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The response could not be completed.");
      setPrompt((current) => current || trimmed);
      setActiveChat((current) => current &&
        current.id === requestChatId &&
        current.messages.at(-1)?.role === "assistant" &&
        !current.messages.at(-1)?.content
          ? { ...current, messages: current.messages.slice(0, -1) }
          : current);
      if (requestChatId) {
        void refreshChats().catch((refreshError: unknown) => {
          console.error("Could not refresh chat history after a failed response:", refreshError);
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const onPromptKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const copyMessage = async (message: ChatMessage, index: number) => {
    await navigator.clipboard.writeText(message.content);
    setCopiedId(`${index}`);
    window.setTimeout(() => setCopiedId(""), 1600);
  };

  const activeProvider = providers.find((provider) => provider.id === providerId);
  const selectedPersona = personas.find((persona) => persona.id === selectedPersonaId);
  const hasMessages = Boolean(activeChat?.messages.length);

  return (
    <div className="app-shell">
      <AnimatePresence>
        {sidebarOpen && <motion.button className="mobile-scrim" aria-label="Close menu" onClick={() => setSidebarOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />}
      </AnimatePresence>
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <button className="brand-mark" aria-label="Sutra home" onClick={() => setActiveChat(null)}>
            <span className="chakra-mark" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></span>
          </button>
          <span className="brand-name">सूत्र</span>
          <button className="icon-button sidebar-close" aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={18} /></button>
          <button className="icon-button desktop-more" aria-label="More options"><MoreHorizontal size={20} /></button>
        </div>

        <button className="new-chat-button" onClick={() => void createChat()}>
          <MessageSquarePlus size={17} strokeWidth={1.8} />
          <span>New conversation</span>
          <span className="shortcut"><Command size={11} /> K</span>
        </button>

        <section className="sidebar-section">
          <div className="section-heading"><span>Conversation style</span><button className="icon-button tiny" aria-label="Create a persona" onClick={() => setPersonaManagerOpen(true)}><Plus size={15} /></button></div>
          <button className="persona-row selected" onClick={() => setPersonaManagerOpen(true)} aria-label="Choose or manage conversation styles">
            <span className="persona-avatar">{selectedPersona?.avatar ?? "सू"}</span>
            <span className="persona-copy"><strong>{selectedPersona?.name ?? "Sutra"}</strong><small>{selectedPersona?.description ?? "Friendly, clear, and neutral"}</small></span>
            <ChevronDown className="persona-row-chevron" size={14} />
          </button>
          <button className="manage-personas-link" onClick={() => setPersonaManagerOpen(true)}>Choose or manage styles</button>
        </section>

        <section className="sidebar-section conversation-section">
          <div className="section-heading"><span>Recent conversations</span></div>
          {chats.length === 0
            ? <p className="sidebar-empty">Your conversations will find a home here.</p>
            : <div className="chat-list">{chats.map((chat) => <button key={chat.id} className={`chat-link ${activeChat?.id === chat.id ? "chat-link-active" : ""}`} onClick={() => { void loadChat(chat.id); setSidebarOpen(false); }}><span>{chat.title}</span></button>)}</div>}
        </section>

        <div className="sidebar-bottom">
          <button className="library-link" onClick={() => setShowTrace((value) => !value)}><Sparkles size={16} /> <span>What Sutra can do</span></button>
          <div className="account-row">
            <div className="account-avatar">{session?.user?.name?.slice(0, 1) ?? "S"}</div>
            <div className="account-copy"><strong>{session?.user?.name ?? "Your account"}</strong><small>{session?.user?.email ?? "Sign in to keep your chats"}</small></div>
            {session?.authenticated
              ? session.googleLoginAvailable && <a className="signout-link" href="/auth/signout">Sign out</a>
              : session?.googleLoginAvailable
                ? <a className="signout-link" href="/auth/signin">Sign in</a>
                : null}
          </div>
        </div>
      </aside>

      <main className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={19} /></button>
            <button className="mode-switch" aria-label="Select conversation style" onClick={() => setPersonaManagerOpen(true)}><span className="persona-avatar small">{selectedPersona?.avatar ?? "सू"}</span><span>{selectedPersona?.name ?? "Sutra"}</span><ChevronDown size={15} /></button>
          </div>
          <div className="topbar-right">
            <button className="icon-button memory-toggle-button" onClick={() => setMemoryManagerOpen(true)} aria-label="Open memory settings" title="Memory" disabled={!session?.authenticated}>
              <Bookmark size={17} />
            </button>
            <button className={`icon-button trace-toggle ${showTrace ? "trace-toggle-active" : ""}`} onClick={() => setShowTrace((value) => !value)} aria-label={showTrace ? "Hide thought panel" : "Show thought panel"}>
              {showTrace ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>
            <button className="model-indicator model-indicator-button" onClick={() => setModelPickerOpen(true)} aria-label="Open model settings">
              <span className="model-indicator-dot" />
              <span className="model-indicator-label">{activeProvider?.label ?? "Choose provider"} · {model || "Choose model"}</span>
              <Settings2 size={14} />
            </button>
          </div>
        </header>

        <div className="conversation-scroll" ref={scrollRef}>
          {!hasMessages ? (
            <div className="welcome-wrap">
              <div className="welcome-symbol" aria-hidden="true"><span className="chakra-mark large"><i /><i /><i /><i /><i /><i /><i /><i /></span></div>
              <motion.div className="welcome-copy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
                <p className="welcome-greeting">A little space to think</p>
                <h1>What’s on your mind?</h1>
                <p className="welcome-description">Bring a question, a half-formed idea, or anything you’d like to understand better.</p>
              </motion.div>
              <div className="prompt-grid">
                {starterPrompts.map((item) => <button className="prompt-suggestion" key={item.title} onClick={() => { setPrompt(`${item.title}: `); textareaRef.current?.focus(); }}><span>{item.title}</span><small>{item.detail}</small></button>)}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {activeChat?.messages.map((message, index) => (
                <article className={`message message-${message.role}`} key={`${activeChat.id}-${index}`}>
                  {message.role === "assistant" && <div className="assistant-glyph" aria-hidden="true">{selectedPersona?.avatar ?? "सू"}</div>}
                  <div className="message-body">
                    <div className="message-role">{message.role === "user" ? "You" : selectedPersona?.name ?? "Sutra"}</div>
                    <div className="message-content">{message.content || (busy ? <span className="typing-indicator"><i /><i /><i /></span> : "")}</div>
                    {message.role === "assistant" && message.content && <div className="message-actions"><button onClick={() => void copyMessage(message, index)}>{copiedId === `${index}` ? <Check size={14} /> : <span>Copy</span>}</button></div>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="composer-wrap">
          {error && <div className="error-banner" role="alert"><span>{error}</span><div className="error-actions">{prompt.trim() && <button type="button" className="error-retry" onClick={() => void sendMessage()} disabled={busy}>Try again</button>}<button className="icon-button tiny" aria-label="Dismiss message" onClick={() => setError("")}><X size={15} /></button></div></div>}
          <form className="composer" onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}>
            <textarea ref={textareaRef} value={prompt} onChange={(event) => setPrompt(event.target.value)} onKeyDown={onPromptKeyDown} placeholder="Share a thought or ask a question…" aria-label="Message Sutra" rows={1} disabled={busy || !session?.authenticated} />
            <div className="composer-toolbar">
              <div className="composer-tools">
                <button className="tool-button attach-button" type="button" aria-label="Add attachment (coming soon)" title="File uploads are coming in a later slice"><Plus size={17} /></button>
                <button className="composer-model-button" type="button" onClick={() => setModelPickerOpen(true)} aria-label={`Choose model, current model ${model || "not selected"}`}>
                  <span className="composer-model-provider">{activeProvider?.label ?? "Provider"}</span>
                  <span className="composer-model-divider" />
                  <span className="composer-model-name">{model || "Choose a model"}</span>
                  <Settings2 size={14} aria-hidden="true" />
                </button>
              </div>
              <button className="send-button" type="submit" aria-label="Send message" disabled={!prompt.trim() || busy || !session?.authenticated || !activeProvider?.configured}>
                {busy ? <span className="send-spinner" /> : <ArrowUp size={18} strokeWidth={2.2} />}
              </button>
            </div>
          </form>
          <p className="composer-note">
            {session?.authenticated
              ? !activeProvider?.configured
                ? "Add your OpenRouter key to the backend to start chatting."
                : "Sutra can make mistakes. Check important details."
              : session?.googleLoginAvailable
                ? <>Sign in to begin. <a href="/auth/signin">Continue with Google</a></>
                : "Configure Google OAuth or local development sign-in to begin."}
          </p>
          {memoryNotice && <p className="memory-live-note" role="status">{memoryNotice}</p>}
        </div>
      </main>

      <AnimatePresence>
        {showTrace && <motion.aside className="trace-panel" initial={{ width: 0, opacity: 0 }} animate={{ width: 292, opacity: 1 }} exit={{ width: 0, opacity: 0 }} transition={{ duration: 0.24 }}>
          <div className="trace-heading"><span>Conversation details</span><button className="icon-button" aria-label="Close details" onClick={() => setShowTrace(false)}><X size={17} /></button></div>
          <div className="trace-empty"><div className="trace-mandala"><span /></div><h2>Conversation details</h2><p>Tool activity and sources will appear here as those features become available.</p></div>
          <div className="trace-footer"><span className="trace-status" /> <span>{busy ? "Response in progress" : "Ready when you are"}</span></div>
        </motion.aside>}
      </AnimatePresence>
      {personaManagerOpen && <PersonaManager
        personas={personas}
        selectedPersonaId={selectedPersonaId}
        onSelect={selectPersona}
        onSave={savePersona}
        onDelete={deletePersona}
        onClose={() => setPersonaManagerOpen(false)}
      />}
      {modelPickerOpen && <ModelPicker
        providers={providers}
        activeProviderId={providerId}
        activeModel={model}
        onSave={saveProviderSettings}
        onUse={(id, selectedModel) => {
          setProviderId(id);
          setModel(selectedModel);
          setModelPickerOpen(false);
        }}
        onClose={() => setModelPickerOpen(false)}
      />}
      {memoryManagerOpen && <MemoryManager
        personas={personas}
        onClose={() => setMemoryManagerOpen(false)}
      />}
      <span className="sr-only" aria-live="polite">{busy ? "Sutra is responding" : ""}</span>
    </div>
  );
}
