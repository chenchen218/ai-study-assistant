import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { Note } from "@/models/Note";

/**
 * Updates a note's content
 * @param request - The incoming request with note content in the body
 * @param params - Route parameters containing the note ID
 * @returns Updated note data or error response
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { title, content } = await request.json();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const note = await Note.findById(id);
    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    // Verify ownership
    if (String(note.userId) !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Update note
    note.title = title || note.title;
    note.content = content;
    await note.save();

    return NextResponse.json({
      success: true,
      note: {
        id: String(note._id),
        title: note.title,
        content: note.content,
      },
    });
  } catch (error: any) {
    console.error("Update note error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

