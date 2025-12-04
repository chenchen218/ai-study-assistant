import mongoose, { Schema, Document, Model } from "mongoose";

export interface IQuizQuestion extends Document {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
  createdAt: Date;
}

const QuizQuestionSchema: Schema = new Schema(
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
    options: {
      type: [String],
      required: true,
      validate: {
        validator: (options: string[]) =>
          options.length >= 2 && options.length <= 6,
        message: "Quiz question must have between 2 and 6 options",
      },
    },
    correctAnswer: {
      type: Number,
      required: true,
      min: 0,
    },
    explanation: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance optimization
QuizQuestionSchema.index({ documentId: 1 }); // For: find({ documentId })
QuizQuestionSchema.index({ userId: 1 }); // For user-specific queries
QuizQuestionSchema.index({ documentId: 1, userId: 1 }); // Compound index for common queries

export const QuizQuestion: Model<IQuizQuestion> =
  mongoose.models.QuizQuestion ||
  mongoose.model<IQuizQuestion>("QuizQuestion", QuizQuestionSchema);
