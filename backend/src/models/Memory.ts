import mongoose, { Schema } from "mongoose";

export type StoredMemoryScope = "user" | "persona";

export interface MemoryDocument extends mongoose.Document {
  ownerId: string;
  scope: StoredMemoryScope;
  scopeId: string;
  content: string;
  fingerprint: string;
  createdAt: Date;
  updatedAt: Date;
}

const MemorySchema = new Schema<MemoryDocument>(
  {
    ownerId: { type: String, required: true },
    scope: { type: String, enum: ["user", "persona"], required: true },
    scopeId: { type: String, required: true },
    content: { type: String, required: true, trim: true, maxlength: 240 },
    fingerprint: { type: String, required: true, maxlength: 64 }
  },
  { timestamps: true }
);

MemorySchema.index(
  { ownerId: 1, scope: 1, scopeId: 1, fingerprint: 1 },
  { unique: true }
);
MemorySchema.index({ ownerId: 1, scope: 1, scopeId: 1, updatedAt: -1 });

export const Memory =
  (mongoose.models.Memory as mongoose.Model<MemoryDocument> | undefined) ??
  mongoose.model<MemoryDocument>("Memory", MemorySchema);
