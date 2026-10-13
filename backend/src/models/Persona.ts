import mongoose, { Schema } from "mongoose";
import type { PersonaParameters, PersonaMemoryScope } from "@sutra/shared";

export interface PersonaDocument extends mongoose.Document {
  ownerId: string;
  starterKey?: string;
  name: string;
  avatar: string;
  description: string;
  systemPrompt: string;
  defaultModel: string;
  defaultParams: PersonaParameters;
  memoryScope: PersonaMemoryScope;
  allowedTools: string[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const PersonaSchema = new Schema<PersonaDocument>(
  {
    ownerId: { type: String, required: true, index: true },
    starterKey: { type: String },
    name: { type: String, required: true, trim: true, maxlength: 40 },
    avatar: { type: String, required: true, trim: true, maxlength: 8 },
    description: { type: String, required: true, trim: true, maxlength: 120 },
    systemPrompt: { type: String, required: true, trim: true, maxlength: 6000 },
    defaultModel: { type: String, trim: true, maxlength: 200, default: "" },
    defaultParams: {
      temperature: { type: Number, min: 0, max: 2 },
      topP: { type: Number, min: 0, max: 1 },
      topK: { type: Number, min: 1, max: 500 },
      maxTokens: { type: Number, min: 1, max: 200000 },
      frequencyPenalty: { type: Number, min: -2, max: 2 },
      presencePenalty: { type: Number, min: -2, max: 2 }
    },
    memoryScope: {
      type: String,
      enum: ["conversation", "user", "persona"],
      required: true,
      default: "persona"
    },
    allowedTools: { type: [String], default: [] },
    deletedAt: { type: Date, default: null, index: true }
  },
  { timestamps: true }
);

PersonaSchema.index(
  { ownerId: 1, starterKey: 1 },
  {
    unique: true,
    partialFilterExpression: { starterKey: { $type: "string" } }
  }
);
PersonaSchema.index({ ownerId: 1, deletedAt: 1, name: 1 });

export const Persona =
  (mongoose.models.Persona as mongoose.Model<PersonaDocument> | undefined) ??
  mongoose.model<PersonaDocument>("Persona", PersonaSchema);
