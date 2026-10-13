# Sutra

Sutra is an Indian/Sanskrit-inspired AI chat harness. Implemented slices include the React/Vite chat UI, Express API, Auth.js Google sign-in, MongoDB chat history, per-user personas, encrypted per-user provider settings, live model lists, and streamed responses from OpenRouter, Ollama, or LocalAI.

## Structure

```text
frontend/src/
  App.tsx                         Application shell
  features/chat/                  Conversation workspace and streaming UI
  features/personas/              Persona management
  features/providers/             Searchable model catalogue and provider settings
  styles.css                      Shared design tokens and responsive styles
backend/src/
  server.ts                       Express bootstrap, auth, and middleware
  features/chats/                 Chat routes and LLM streaming
  features/personas/              Persona routes and domain operations
  features/providers/             Provider routes, settings, and error mapping
  features/memory/                 Long-term memory extraction and controls
  models/                         MongoDB schemas
  shared/                         Reused validation and infrastructure
shared/src/                       Types shared by the frontend and backend
docker/                            Backend and frontend development images
docker-compose.yml                 MongoDB, ChromaDB, backend, and frontend
```

The `src` directory is the standard location for application source. Sutra organizes code under it by product feature, separating UI, routes, validation, and provider responsibilities rather than concentrating them in one large app or server file.

## Environment variables

Copy `.env.example` to `.env` and set the values you use:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Runtime mode. Use `development` locally. |
| `PORT` | Express API port (default `3001`). |
| `MONGODB_URI` | MongoDB connection string. |
| `AUTH_SECRET` | Auth.js session/JWT signing secret; use a unique random value of at least 32 characters. |
| `AUTH_GOOGLE_ID` | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret. |
| `DEV_AUTH_BYPASS` | Local-only guest authentication. Ignored in production. |
| `OPENROUTER_API_KEY` | Server-side OpenRouter API key. |
| `OPENROUTER_DEFAULT_MODEL` | Default OpenRouter model. |
| `OLLAMA_BASE_URL` | OpenAI-compatible Ollama endpoint. |
| `OLLAMA_API_KEY` | Optional Ollama API key; Ollama commonly accepts a placeholder. |
| `OLLAMA_DEFAULT_MODEL` | Default Ollama model name. |
| `LOCALAI_BASE_URL` | OpenAI-compatible LocalAI endpoint. |
| `LOCALAI_API_KEY` | Optional LocalAI API key. |
| `LOCALAI_DEFAULT_MODEL` | Default LocalAI model name. |
| `CHROMA_URL` | ChromaDB endpoint for the planned RAG slice. |
| `LANGFUSE_PUBLIC_KEY` | Langfuse public key for planned tracing. |
| `LANGFUSE_SECRET_KEY` | Langfuse secret key for planned tracing. |
| `LANGFUSE_BASE_URL` | Self-hosted Langfuse endpoint. |
| `TOKEN_ENCRYPTION_KEY` | Stable server-side 32-byte key for encrypting saved provider credentials; use 64 hex characters or base64. |

The `TOKEN_ENCRYPTION_KEY` is required only when a user saves a provider key in the settings panel. Generate one with `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Keep it stable and backed up: changing it makes existing saved keys unreadable. Provider keys are encrypted by the backend and are never returned to the browser.

The persona slice seeds eight starter styles per user and supports private persona creation, editing, deletion, switching within conversations, system prompts, model defaults, sampling parameters, memory scope, and tool permission lists. The provider settings panel supports per-user endpoints and default models, encrypted keys, searchable model listing, response parameters, and system-prompt overrides. Chat errors identify common credential, billing, model, rate-limit, and provider availability failures; failed prompts remain available to retry, and logs include safe request correlation IDs.

Long-term memory is on by default and can be disabled or cleared from the memory controls. After most responses, the selected provider receives one additional short extraction request to identify explicitly stated, non-sensitive facts; messages with apparent contact, location, credential, or sensitive-category details are skipped. Users can review and remove saved entries. Memories are isolated per account and either per persona or across personas, according to the persona's memory scope. Conversation-only scope does not persist memories.

MCP/tools, browser agent, RAG, multimodal support, moderation, Langfuse tracing, and deployment hardening remain unimplemented follow-on slices. They will be added under feature modules as their interfaces and data flows are built, rather than as placeholder files.

## Run locally

1. Install Node.js 22 or newer and MongoDB.
2. Copy `.env.example` to `.env`. `DEV_AUTH_BYPASS=true` works only outside production; set `OPENROUTER_API_KEY` if you want to use OpenRouter. Local providers may be selected without a hosted key. To save provider keys from Model settings, set `TOKEN_ENCRYPTION_KEY`.
3. Run `npm install`, then `npm run dev`.
4. Open `http://localhost:5173`.

Run `npm test` for the provider credential and model-list tests.

To use Google sign-in, create OAuth credentials with callback URL `http://localhost:3001/auth/callback/google`, then fill `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `AUTH_SECRET`.

## Run with Docker Compose

Copy `.env.example` to `.env`, then run `docker compose up --build`. Open `http://localhost:5173`. MongoDB and ChromaDB run in containers; local Ollama and LocalAI endpoints default to `host.docker.internal`.

## Initial visual direction

- **Palette:** Rice paper `#F7F3EC`, temple stone `#F0EBE2`, ink indigo `#272943`, fired saffron `#B45D2B`, muted teal `#517D79`, and lamp gold `#C29A52`.
- **Type:** Tiro Devanagari Sanskrit carries the Sutra wordmark and welcome headline; Mukta keeps conversational copy warm and legible; Inter handles compact controls.
- **Layout:** A quiet conversation workspace frames the central prompt with a narrow persona/history rail and an optional reasoning panel; controls and messages remain left-aligned for easy scanning.
- **Principles:** The chakra is the single visual signature; other Vedic references stay subdued. Generous whitespace and direct language keep the tool calm rather than ceremonial.

The brief already specifies a paper/ivory palette and a Claude-like three-part workspace, so the initial design follows that direction rather than introducing an unrelated color or layout system. The chakra mark is used sparingly as the Sutra-specific anchor.

## Deploy notes

Deploy the Vite frontend to Vercel and the Express backend to a Node-capable host such as Render, Railway, Fly.io, or a VPS. Set the frontend's API/auth proxy or deploy frontend and API behind the same origin; configure `AUTH_SECRET`, Google OAuth credentials, MongoDB, provider endpoints, and secrets in the backend host. Keep `TOKEN_ENCRYPTION_KEY` stable across deploys and backups. ChromaDB must be reachable privately by the backend. Langfuse, RAG, and moderation still need additional production environment setup.
