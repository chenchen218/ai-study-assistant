import mongoose, { Schema, Model } from "mongoose";

export interface IStudySession extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  documentId?: mongoose.Types.ObjectId;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  activityType: "reading" | "flashcards" | "quiz" | "notes" | "qa";
  createdAt: Date;
  updatedAt: Date;
}

const StudySessionSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "Document",
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    endTime: {
      type: Date,
    },
    duration: {
      type: Number,
      default: 0,
    },
    activityType: {
      type: String,
      enum: ["reading", "flashcards", "quiz", "notes", "qa"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const StudySession: Model<IStudySession> =
  mongoose.models.StudySession ||
  mongoose.model<IStudySession>("StudySession", StudySessionSchema);
