import mongoose, { Schema, Model } from "mongoose";

export interface IFlashcardPerformance extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  flashcardId: mongoose.Types.ObjectId;
  isKnown: boolean; // user marked as "know" or "need review"
  timeSpent: number; // in seconds
  reviewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FlashcardPerformanceSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
      required: true,
    },
    flashcardId: {
      type: Schema.Types.ObjectId,
      ref: "Flashcard",
      required: true,
    },
    isKnown: {
      type: Boolean,
      required: true,
    },
    timeSpent: {
      type: Number,
      default: 0,
    },
    reviewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance optimization
// Single field indexes
FlashcardPerformanceSchema.index({ userId: 1 }); // For user-specific queries
FlashcardPerformanceSchema.index({ documentId: 1 }); // For document-specific queries
FlashcardPerformanceSchema.index({ flashcardId: 1 }); // For flashcard-specific queries

// Compound indexes for common query patterns
FlashcardPerformanceSchema.index({ userId: 1, documentId: 1 }); // For: find({ userId, documentId })
FlashcardPerformanceSchema.index({ userId: 1, reviewedAt: -1 }); // For: find({ userId }).sort({ reviewedAt: -1 })
FlashcardPerformanceSchema.index({ userId: 1, isKnown: 1 }); // For mastered flashcards queries

export const FlashcardPerformance: Model<IFlashcardPerformance> =
  mongoose.models.FlashcardPerformance ||
  mongoose.model<IFlashcardPerformance>(
    "FlashcardPerformance",
    FlashcardPerformanceSchema
  );
