import mongoose, { Schema } from "mongoose";

interface StoredMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface ChatDocument extends mongoose.Document {
  ownerId: string;
  title: string;
  personaId: string | null;
  messages: Array<StoredMessage & { _id?: mongoose.Types.ObjectId }>;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, required: true, default: Date.now }
  },
  { _id: true }
);

const ChatSchema = new Schema<ChatDocument>(
  {
    ownerId: { type: String, required: true, index: true },
    title: { type: String, required: true, maxlength: 120 },
    personaId: { type: String, default: null },
    messages: { type: [MessageSchema], default: [] }
  },
  { timestamps: true }
);

ChatSchema.index({ ownerId: 1, updatedAt: -1 });

export const Chat =
  (mongoose.models.Chat as mongoose.Model<ChatDocument> | undefined) ??
  mongoose.model<ChatDocument>("Chat", ChatSchema);
