import mongoose, { Schema } from "mongoose";
import type { PersonaParameters, ProviderId } from "@sutra/shared";

export interface ProviderConfigDocument extends mongoose.Document {
  ownerId: string;
  provider: ProviderId;
  baseUrl: string;
  apiTokenEncrypted: string | null;
  defaultModel: string;
  defaultParams: PersonaParameters;
  systemPromptOverride: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProviderConfigSchema = new Schema<ProviderConfigDocument>(
  {
    ownerId: { type: String, required: true },
    provider: {
      type: String,
      enum: ["openrouter", "ollama", "localai"],
      required: true
    },
    baseUrl: { type: String, required: true, maxlength: 500 },
    apiTokenEncrypted: { type: String, default: null, select: false },
    defaultModel: { type: String, trim: true, maxlength: 200, default: "" },
    defaultParams: {
      temperature: { type: Number, min: 0, max: 2 },
      topP: { type: Number, min: 0, max: 1 },
      topK: { type: Number, min: 1, max: 500 },
      maxTokens: { type: Number, min: 1, max: 200000 },
      frequencyPenalty: { type: Number, min: -2, max: 2 },
      presencePenalty: { type: Number, min: -2, max: 2 }
    },
    systemPromptOverride: { type: String, trim: true, maxlength: 6000, default: "" }
  },
  { timestamps: true }
);

ProviderConfigSchema.index({ ownerId: 1, provider: 1 }, { unique: true });

export const ProviderConfig =
  (mongoose.models.ProviderConfig as mongoose.Model<ProviderConfigDocument> | undefined) ??
  mongoose.model<ProviderConfigDocument>("ProviderConfig", ProviderConfigSchema);
