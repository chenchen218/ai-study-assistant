import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDocument extends Document {
  userId: mongoose.Types.ObjectId;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Key: string;
  s3Url: string;
  originalName: string;
  uploadedAt: Date;
  status: "processing" | "completed" | "failed";
}

const DocumentSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
      enum: ["pdf", "docx"],
    },
    fileSize: {
      type: Number,
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    s3Url: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },
  },
  {
    timestamps: true,
  }
);

export const Document: Model<IDocument> =
  mongoose.models.Document ||
  mongoose.model<IDocument>("Document", DocumentSchema);
