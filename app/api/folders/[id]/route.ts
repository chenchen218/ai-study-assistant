import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Folder } from "@/models/Folder";
import { Document } from "@/models/Document";
import { getUserIdFromRequest } from "@/lib/auth";
import mongoose from "mongoose";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

/**
 * PUT /api/folders/[id]
 * Update folder name or color
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const { name, color } = await request.json();

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Folder name is required" },
        { status: 400 }
      );
    }

    const folder = await Folder.findOne({ _id: id, userId });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    // Check if another folder with same name exists
    if (name.trim() !== folder.name) {
      const existingFolder = await Folder.findOne({
        userId,
        name: name.trim(),
        _id: { $ne: id },
      });

      if (existingFolder) {
        return NextResponse.json(
          { error: "A folder with this name already exists" },
          { status: 400 }
        );
      }
    }

    folder.name = name.trim();
    if (color) {
      folder.color = color;
    }
    await folder.save();

    console.log(`✅ Folder updated: ${folder.name} for user ${userId}`);

    return NextResponse.json({
      success: true,
      folder: {
        id: folder._id,
        name: folder.name,
        color: folder.color,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      },
    });
  } catch (error: any) {
    console.error("Error updating folder:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/[id]
 * Delete a folder (moves documents to root)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const folder = await Folder.findOne({ _id: id, userId });

    if (!folder) {
      return NextResponse.json(
        { error: "Folder not found" },
        { status: 404 }
      );
    }

    // Move all documents in this folder to root (set folderId to null)
    await Document.updateMany(
      { userId, folderId: new mongoose.Types.ObjectId(id) },
      { $unset: { folderId: "" } }
    );

    // Delete the folder
    await Folder.findByIdAndDelete(id);

    console.log(`✅ Folder deleted: ${folder.name} for user ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Folder deleted successfully",
    });
  } catch (error: any) {
    console.error("Error deleting folder:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

