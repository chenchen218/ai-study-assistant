import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { StudySession } from "@/models/StudySession";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read request body once - it can only be read once
    const body = await request.json();
    const { action, documentId, activityType, sessionId, duration } = body;

    if (action === "start") {
      // Start a new study session
      const session = await StudySession.create({
        userId,
        documentId: documentId || undefined,
        activityType: activityType || "reading",
        startTime: new Date(),
      });

      return NextResponse.json({
        sessionId: String(session._id),
        message: "Study session started",
      });
    } else if (action === "end") {
      // End a study session
      if (!sessionId) {
        return NextResponse.json(
          { error: "Session ID is required" },
          { status: 400 }
        );
      }

      const session = await StudySession.findByIdAndUpdate(
        sessionId,
        {
          endTime: new Date(),
          duration: duration || 0,
        },
        { new: true }
      );

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        message: "Study session ended",
        duration: session.duration,
      });
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'start' or 'end'" },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Study session error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
