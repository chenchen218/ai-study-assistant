import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { Folder } from "@/models/Folder";
import { getUserIdFromRequest } from "@/lib/auth";
import { createFolderSchema, validateRequestWithError } from "@/lib/validations";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

/**
 * GET /api/folders
 * Get all folders for the current user
 */
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const folders = await Folder.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      success: true,
      folders: folders.map((folder) => ({
        id: folder._id,
        name: folder.name,
        color: folder.color,
        createdAt: folder.createdAt,
        updatedAt: folder.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching folders:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/folders
 * Create a new folder
 */
export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract and validate folder data from request body
    const body = await request.json();
    const validation = validateRequestWithError(createFolderSchema, body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: validation.status }
      );
    }

    const { name, parentId } = validation.data;
    const color = body.color || "#8B5CF6"; // Color is optional, use default if not provided

    // Check if folder with same name already exists
    const existingFolder = await Folder.findOne({
      userId,
      name, // Already trimmed by Zod
    });

    if (existingFolder) {
      return NextResponse.json(
        { error: "A folder with this name already exists" },
        { status: 400 }
      );
    }

    const folder = await Folder.create({
      userId,
      name, // Already trimmed by Zod
      color,
      parentId: parentId || undefined,
    });

    console.log(`✅ Folder created: ${folder.name} for user ${userId}`);

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
    console.error("Error creating folder:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}



