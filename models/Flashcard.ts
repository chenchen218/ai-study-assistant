import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFlashcard extends Document {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  question: string;
  answer: string;
  createdAt: Date;
}

const FlashcardSchema: Schema = new Schema(
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
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance optimization
FlashcardSchema.index({ documentId: 1 }); // For: find({ documentId })
FlashcardSchema.index({ userId: 1 }); // For user-specific queries
FlashcardSchema.index({ documentId: 1, userId: 1 }); // Compound index for common queries

export const Flashcard: Model<IFlashcard> =
  mongoose.models.Flashcard ||
  mongoose.model<IFlashcard>("Flashcard", FlashcardSchema);
