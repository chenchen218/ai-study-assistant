import mongoose, { Schema, Model, Document } from "mongoose";

export interface IAICost extends Document {
  userId: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId;
  operation: string; // "generateSummary", "generateNotes", "generateFlashcards", etc.
  modelName: string; // AI model name (e.g., "models/gemini-2.5-flash")
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number; // Cost in USD
  metadata?: Record<string, any>;
  createdAt: Date;
}

const AICostSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      index: true,
    },
    operation: {
      type: String,
      required: true,
      index: true,
    },
    modelName: {
      type: String,
      required: true,
    },
    inputTokens: {
      type: Number,
      required: true,
    },
    outputTokens: {
      type: Number,
      required: true,
    },
    totalTokens: {
      type: Number,
      required: true,
    },
    cost: {
      type: Number,
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
AICostSchema.index({ userId: 1, createdAt: -1 }); // For user cost history
AICostSchema.index({ documentId: 1 }); // For document cost tracking
AICostSchema.index({ operation: 1, createdAt: -1 }); // For operation-based analytics
AICostSchema.index({ createdAt: -1 }); // For time-based queries

export const AICost: Model<IAICost> =
  mongoose.models.AICost || mongoose.model<IAICost>("AICost", AICostSchema);
