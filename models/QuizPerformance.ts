import mongoose, { Schema, Model } from "mongoose";

export interface IQuizPerformance extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  quizQuestionId: mongoose.Types.ObjectId;
  selectedAnswer: number;
  correctAnswer: number;
  isCorrect: boolean;
  timeSpent: number; // in seconds
  attemptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuizPerformanceSchema: Schema = new Schema(
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
    quizQuestionId: {
      type: Schema.Types.ObjectId,
      ref: "QuizQuestion",
      required: true,
    },
    selectedAnswer: {
      type: Number,
      required: true,
    },
    correctAnswer: {
      type: Number,
      required: true,
    },
    isCorrect: {
      type: Boolean,
      required: true,
    },
    timeSpent: {
      type: Number,
      default: 0,
    },
    attemptedAt: {
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
QuizPerformanceSchema.index({ userId: 1 }); // For user-specific queries
QuizPerformanceSchema.index({ documentId: 1 }); // For document-specific queries
QuizPerformanceSchema.index({ quizQuestionId: 1 }); // For question-specific queries

// Compound indexes for common query patterns
QuizPerformanceSchema.index({ userId: 1, documentId: 1 }); // For: find({ userId, documentId })
QuizPerformanceSchema.index({ userId: 1, attemptedAt: -1 }); // For: find({ userId }).sort({ attemptedAt: -1 })
QuizPerformanceSchema.index({ documentId: 1, attemptedAt: -1 }); // For document-specific history

export const QuizPerformance: Model<IQuizPerformance> =
  mongoose.models.QuizPerformance ||
  mongoose.model<IQuizPerformance>("QuizPerformance", QuizPerformanceSchema);
