import mongoose, { Schema, Model } from "mongoose";

export interface IDocument extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  fileName: string;
  fileType: string;
  fileSize: number;
  s3Key?: string;
  s3Url?: string;
  originalName: string;
  folderId?: mongoose.Types.ObjectId;
  // YouTube-specific fields
  youtubeUrl?: string;
  youtubeVideoId?: string;
  youtubeThumbnail?: string;
  videoDuration?: number; // Duration in seconds
  youtubeCategory?: string;
  isEducational?: boolean;
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
      enum: ["pdf", "docx", "youtube"],
    },
    fileSize: {
      type: Number,
      required: function(this: IDocument) {
        return this.fileType !== "youtube";
      },
      default: 0,
    },
    s3Key: {
      type: String,
      required: function(this: IDocument) {
        return this.fileType !== "youtube";
      },
    },
    s3Url: {
      type: String,
      required: function(this: IDocument) {
        return this.fileType !== "youtube";
      },
    },
    originalName: {
      type: String,
      required: true,
    },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
    },
    // YouTube-specific fields
    youtubeUrl: {
      type: String,
      required: function(this: IDocument) {
        return this.fileType === "youtube";
      },
    },
    youtubeVideoId: {
      type: String,
    },
    youtubeThumbnail: {
      type: String,
    },
    videoDuration: {
      type: Number, // Duration in seconds
    },
    youtubeCategory: {
      type: String,
    },
    isEducational: {
      type: Boolean,
      default: true,
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
