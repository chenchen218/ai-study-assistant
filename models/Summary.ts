import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISummary extends Document {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  content: string;
  createdAt: Date;
}

const SummarySchema: Schema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance optimization
SummarySchema.index({ documentId: 1 }); // For: findOne({ documentId })
SummarySchema.index({ userId: 1 }); // For user-specific queries
SummarySchema.index({ documentId: 1 }, { unique: true }); // One summary per document

export const Summary: Model<ISummary> =
  mongoose.models.Summary || mongoose.model<ISummary>("Summary", SummarySchema);
