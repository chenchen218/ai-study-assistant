import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Document } from "@/models/Document";
import { getUserIdFromRequest } from "@/lib/auth";
import { documentRenameSchema, validateRequestWithError } from "@/lib/validations";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

/**
 * PUT /api/documents/[id]/rename
 * Rename a document
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
    
    // Extract and validate file name from request body
    const body = await request.json();
    const validation = validateRequestWithError(documentRenameSchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const { fileName } = validation.data;

    const document = await Document.findOne({ _id: id, userId });

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    document.fileName = fileName; // Already trimmed by Zod
    await document.save();

    console.log(`✅ Document renamed: ${document.fileName} for user ${userId}`);

    return NextResponse.json({
      success: true,
      document: {
        id: document._id,
        fileName: document.fileName,
        fileType: document.fileType,
        status: document.status,
        uploadedAt: document.uploadedAt,
      },
    });
  } catch (error: any) {
    console.error("Error renaming document:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}



