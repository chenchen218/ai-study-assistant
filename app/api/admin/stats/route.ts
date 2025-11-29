import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { Document } from "@/models/Document";
import { isAdmin } from "@/lib/auth";

// Force dynamic rendering since we use request.headers
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    if (!isAdmin(request)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    // Get statistics
    const [totalUsers, totalDocuments, documentsByStatus] = await Promise.all([
      User.countDocuments(),
      Document.countDocuments(),
      Document.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const statusCounts = documentsByStatus.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    const recentDocuments = await Document.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email")
      .select("-s3Key");

    return NextResponse.json({
      stats: {
        totalUsers,
        totalDocuments,
        statusCounts: {
          processing: statusCounts.processing || 0,
          completed: statusCounts.completed || 0,
          failed: statusCounts.failed || 0,
        },
      },
      recentDocuments: recentDocuments.map((doc) => ({
        id: doc._id,
        fileName: doc.fileName,
        userName: (doc.userId as any)?.name,
        userEmail: (doc.userId as any)?.email,
        status: doc.status,
        uploadedAt: doc.uploadedAt,
      })),
    });
  } catch (error: any) {
    console.error("Admin dashboard error:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
