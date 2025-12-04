import mongoose, { Schema, Document, Model } from "mongoose";

export interface IUser extends Document {
  email: string;
  password?: string;
  name: string;
  role: "user" | "admin";
  provider?: "local" | "google" | "github";
  googleId?: string;
  githubId?: string;
  picture?: string;
  avatar?: string; // S3 key for user-uploaded avatar
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: function (this: IUser) {
        return this.provider === "local";
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    provider: {
      type: String,
      enum: ["local", "google", "github"],
      default: "local",
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    githubId: {
      type: String,
      sparse: true,
      unique: true,
    },
    picture: {
      type: String,
    },
    avatar: {
      type: String, // S3 key for user-uploaded avatar
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for performance optimization
// email already has unique index from schema definition
// googleId and githubId already have unique sparse indexes from schema definition
// Additional indexes for common queries
UserSchema.index({ provider: 1 }); // For filtering by provider
UserSchema.index({ role: 1 }); // For admin queries
UserSchema.index({ createdAt: -1 }); // For sorting by creation date

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>("User", UserSchema);
