import mongoose, { Schema, Model, Document } from "mongoose";

export interface IWrongAnswer extends Document {
  userId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  quizQuestionId: mongoose.Types.ObjectId;
  question: string;
  options: string[];
  selectedAnswer: number;
  correctAnswer: number;
  explanation?: string;
  attemptedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WrongAnswerSchema: Schema = new Schema(
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
    question: {
      type: String,
      required: true,
    },
    options: {
      type: [String],
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
    explanation: {
      type: String,
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

// Create index to prevent duplicate wrong answers for the same question
WrongAnswerSchema.index({ userId: 1, quizQuestionId: 1 }, { unique: true });

// Additional indexes for performance optimization
WrongAnswerSchema.index({ userId: 1 }); // For user-specific queries
WrongAnswerSchema.index({ documentId: 1 }); // For document-specific queries
WrongAnswerSchema.index({ userId: 1, documentId: 1 }); // For: find({ userId, documentId })
WrongAnswerSchema.index({ userId: 1, attemptedAt: -1 }); // For sorting by date

export const WrongAnswer: Model<IWrongAnswer> =
  mongoose.models.WrongAnswer ||
  mongoose.model<IWrongAnswer>("WrongAnswer", WrongAnswerSchema);
