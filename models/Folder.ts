import mongoose, { Schema, Document, Model } from "mongoose";

export interface IFolder extends Document {
  userId: mongoose.Types.ObjectId;
  name: string;
  color?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FolderSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    color: {
      type: String,
      default: "#8B5CF6", // Default purple color
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
FolderSchema.index({ userId: 1, name: 1 });

export const Folder: Model<IFolder> =
  mongoose.models.Folder || mongoose.model<IFolder>("Folder", FolderSchema);



