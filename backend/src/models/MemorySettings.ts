import mongoose, { Schema } from "mongoose";

export interface MemorySettingsDocument extends mongoose.Document {
  ownerId: string;
  enabled: boolean;
  revision: number;
  createdAt: Date;
  updatedAt: Date;
}

const MemorySettingsSchema = new Schema<MemorySettingsDocument>(
  {
    ownerId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, required: true, default: true },
    revision: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

export const MemorySettings =
  (mongoose.models.MemorySettings as mongoose.Model<MemorySettingsDocument> | undefined) ??
  mongoose.model<MemorySettingsDocument>("MemorySettings", MemorySettingsSchema);
