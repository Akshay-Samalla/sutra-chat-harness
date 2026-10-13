import { Router } from "express";
import mongoose from "mongoose";
import { Memory } from "../../models/Memory.js";
import { MemorySettings } from "../../models/MemorySettings.js";
import { advanceMemoryRevision } from "./memory.service.js";

const memoryRouter = Router();

memoryRouter.get("/", async (_req, res, next) => {
  try {
    const ownerId = res.locals.ownerId as string;
    const [settings, memories] = await Promise.all([
      MemorySettings.findOne({ ownerId }).select("enabled").lean(),
      Memory.find({ ownerId }).sort({ updatedAt: -1 }).limit(100).lean()
    ]);
    res.json({
      enabled: settings?.enabled ?? true,
      memories: memories.map((memory) => ({
        id: String(memory._id),
        content: memory.content,
        scope: memory.scope,
        personaId: memory.scope === "persona" ? memory.scopeId : null,
        updatedAt: memory.updatedAt.toISOString()
      }))
    });
  } catch (error) {
    next(error);
  }
});

memoryRouter.patch("/settings", async (req, res, next) => {
  if (typeof req.body?.enabled !== "boolean") {
    res.status(400).json({ error: "Choose whether Sutra can save memories." });
    return;
  }
  try {
    const settings = await MemorySettings.findOneAndUpdate(
      { ownerId: res.locals.ownerId },
      { $set: { enabled: req.body.enabled }, $inc: { revision: 1 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ enabled: settings.enabled });
  } catch (error) {
    next(error);
  }
});

memoryRouter.delete("/", async (_req, res, next) => {
  try {
    await advanceMemoryRevision(res.locals.ownerId);
    await Memory.deleteMany({ ownerId: res.locals.ownerId });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

memoryRouter.delete("/:memoryId", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.memoryId)) {
    res.status(404).json({ error: "Memory not found." });
    return;
  }
  try {
    await advanceMemoryRevision(res.locals.ownerId);
    const result = await Memory.deleteOne({
      _id: req.params.memoryId,
      ownerId: res.locals.ownerId
    });
    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Memory not found." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default memoryRouter;
