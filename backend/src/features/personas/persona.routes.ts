import { Router } from "express";
import mongoose from "mongoose";
import { Chat } from "../../models/Chat.js";
import { Memory } from "../../models/Memory.js";
import { Persona as PersonaModel } from "../../models/Persona.js";
import {
  findPersonaForOwner,
  parsePersonaDraft,
  serializePersona,
  starterPersonas
} from "./persona.service.js";

const personaRouter = Router();

personaRouter.get("/", async (_req, res, next) => {
  try {
    const ownerId = res.locals.ownerId as string;
    for (const template of starterPersonas) {
      try {
        await PersonaModel.updateOne(
          { ownerId, starterKey: template.starterKey },
          { $setOnInsert: { ownerId, ...template, deletedAt: null } },
          { upsert: true, runValidators: true }
        );
      } catch (error) {
        if (!(error instanceof mongoose.mongo.MongoServerError) || error.code !== 11000) {
          throw error;
        }
      }
    }
    const personas = await PersonaModel.find({ ownerId, deletedAt: null }).sort({
      starterKey: 1,
      name: 1
    });
    res.json({ personas: personas.map(serializePersona) });
  } catch (error) {
    next(error);
  }
});

personaRouter.post("/", async (req, res, next) => {
  const draft = parsePersonaDraft(req.body);
  if (!draft) {
    res.status(400).json({ error: "Check the persona name, prompt, settings, and tool permissions." });
    return;
  }

  try {
    const persona = await PersonaModel.create({
      ownerId: res.locals.ownerId,
      ...draft,
      starterKey: undefined,
      deletedAt: null
    });
    res.status(201).json({ persona: serializePersona(persona) });
  } catch (error) {
    next(error);
  }
});

personaRouter.put("/:personaId", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.personaId)) {
    res.status(404).json({ error: "Persona not found." });
    return;
  }
  const draft = parsePersonaDraft(req.body);
  if (!draft) {
    res.status(400).json({ error: "Check the persona name, prompt, settings, and tool permissions." });
    return;
  }

  try {
    const persona = await PersonaModel.findOneAndUpdate(
      { _id: req.params.personaId, ownerId: res.locals.ownerId, deletedAt: null },
      { $set: draft },
      { new: true, runValidators: true }
    );
    if (!persona) {
      res.status(404).json({ error: "Persona not found." });
      return;
    }
    res.json({ persona: serializePersona(persona) });
  } catch (error) {
    next(error);
  }
});

personaRouter.delete("/:personaId", async (req, res, next) => {
  if (!mongoose.isValidObjectId(req.params.personaId)) {
    res.status(404).json({ error: "Persona not found." });
    return;
  }

  try {
    const persona = await PersonaModel.findOneAndUpdate(
      { _id: req.params.personaId, ownerId: res.locals.ownerId, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
    if (!persona) {
      res.status(404).json({ error: "Persona not found." });
      return;
    }
    await Chat.updateMany(
      { ownerId: res.locals.ownerId, personaId: req.params.personaId },
      { $set: { personaId: null } }
    );
    await Memory.deleteMany({
      ownerId: res.locals.ownerId,
      scope: "persona",
      scopeId: req.params.personaId
    });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

export default personaRouter;
