import mongoose, { Schema, Document, Model } from "mongoose";

export interface INote extends Document {
  documentId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  createdAt: Date;
}

const NoteSchema: Schema = new Schema(
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
    title: {
      type: String,
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
NoteSchema.index({ documentId: 1 }); // For: findOne({ documentId })
NoteSchema.index({ userId: 1 }); // For user-specific queries
NoteSchema.index({ documentId: 1 }, { unique: true }); // One note per document

export const Note: Model<INote> =
  mongoose.models.Note || mongoose.model<INote>("Note", NoteSchema);
