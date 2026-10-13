import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type NextFunction, type Request, type Response } from "express";
import { ExpressAuth, getSession } from "@auth/express";
import Google from "@auth/express/providers/google";
import dotenv from "dotenv";
import mongoose from "mongoose";
import providerRouter from "./features/providers/provider.routes.js";
import chatRouter from "./features/chats/chat.routes.js";
import personaRouter from "./features/personas/persona.routes.js";
import memoryRouter from "./features/memory/memory.routes.js";

dotenv.config({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

const app = express();
const port = Number(process.env.PORT ?? 3001);
const developmentBypass =
  process.env.NODE_ENV !== "production" && process.env.DEV_AUTH_BYPASS === "true";
const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

if (process.env.NODE_ENV === "production") {
  if (!process.env.AUTH_SECRET || !googleConfigured) {
    throw new Error("Production requires AUTH_SECRET, AUTH_GOOGLE_ID, and AUTH_GOOGLE_SECRET.");
  }
  if (developmentBypass) {
    throw new Error("DEV_AUTH_BYPASS cannot be enabled in production.");
  }
}

app.set("trust proxy", 1);
app.use(express.json({ limit: "2mb" }));

const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  providers: googleConfigured ? [Google] : []
};

if (googleConfigured) {
  app.use("/auth/*", ExpressAuth(authConfig));
}

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/session", async (req, res, next) => {
  try {
    const ownerId = await getOwnerId(req);
    res.json({
      authenticated: Boolean(ownerId),
      user: ownerId
        ? {
            id: ownerId,
            name: developmentBypass ? "Sutra guest" : undefined,
            email: ownerId
          }
        : null,
      googleLoginAvailable: googleConfigured
    });
  } catch (error) {
    next(error);
  }
});

app.use("/api", async (req, res, next) => {
  try {
    const ownerId = await getOwnerId(req);
    if (!ownerId) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }
    res.locals.ownerId = ownerId;
    next();
  } catch (error) {
    next(error);
  }
});

app.use("/api/providers", providerRouter);
app.use("/api/personas", personaRouter);
app.use("/api/chats", chatRouter);
app.use("/api/memories", memoryRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Request failed:", error);
  if (res.headersSent) {
    res.end();
    return;
  }
  res.status(500).json({ error: "The request could not be completed." });
});

async function getOwnerId(req: Request): Promise<string | null> {
  if (developmentBypass) {
    return "dev@sutra.local";
  }
  if (!googleConfigured) {
    return null;
  }
  const session = await getSession(req, authConfig);
  const email = session?.user?.email?.trim().toLowerCase();
  return email || null;
}

async function start() {
  const mongoUri = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/sutra";
  await mongoose.connect(mongoUri);
  app.listen(port, () => {
    console.log(`Sutra API listening on http://localhost:${port}`);
  });
}

start().catch((error: unknown) => {
  console.error("Backend startup failed:", error);
  process.exitCode = 1;
});
