import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { Folder } from "@/models/Folder";
import { getUserIdFromRequest } from "@/lib/auth";
import mongoose from "mongoose";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

/**
 * PUT /api/documents/[id]/move
 * Move a document to a folder (or root if folderId is null)
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
    const { folderId } = await request.json();

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // If folderId is provided, verify it exists and belongs to user
    if (folderId) {
      const folder = await Folder.findOne({
        _id: folderId,
        userId,
      });

      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 }
        );
      }

      document.folderId = new mongoose.Types.ObjectId(folderId);
    } else {
      // Move to root
      document.folderId = undefined;
    }

    await document.save();

    console.log(
      `✅ Document ${document.fileName} moved to folder ${folderId || "root"} for user ${userId}`
    );

    return NextResponse.json({
      success: true,
      document: {
        id: document._id,
        fileName: document.fileName,
        fileType: document.fileType,
        status: document.status,
        folderId: document.folderId,
        uploadedAt: document.uploadedAt,
      },
    });
  } catch (error: any) {
    console.error("Error moving document:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}



