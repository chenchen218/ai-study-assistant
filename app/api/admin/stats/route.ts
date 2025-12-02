/**
 * Admin Statistics API Route
 * 
 * This endpoint provides system-wide statistics and recent activity data for admin users.
 * It aggregates data across all users and documents to provide system insights.
 * 
 * Statistics Provided:
 * - Total Users: Count of all registered users in the system
 * - Total Documents: Count of all uploaded documents
 * - Status Counts: Breakdown of documents by processing status (processing, completed, failed)
 * - Recent Documents: Last 10 uploaded documents with user information
 * 
 * Security:
 * - Requires admin role (checked via isAdmin() function)
 * - Returns 403 Forbidden if user is not an admin
 * - Only admin users can access system-wide statistics
 * 
 * Performance:
 * - Uses Promise.all for parallel queries to improve response time
 * - MongoDB aggregation pipeline for efficient status counting
 * - Limits recent documents to 10 for performance
 * - Excludes sensitive S3 keys from response
 * 
 * Data Privacy:
 * - Returns user names and emails for recent documents (admin oversight)
 * - Does not expose sensitive user data beyond what's necessary
 * 
 * @route GET /api/admin/stats
 * @access Admin only (requires admin role)
 * @returns System statistics and recent document uploads
 */

import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { Document } from "@/models/Document";
import { isAdmin } from "@/lib/auth";

// Force dynamic rendering since we use request.headers for authentication
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Establish connection to MongoDB database
    await connectDB();

    // Verify user has admin role
    // Only admin users can access system-wide statistics
    // This prevents regular users from accessing sensitive system data
    if (!isAdmin(request)) {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    // Get statistics in parallel for better performance
    // Promise.all executes all queries concurrently, reducing total response time
    const [totalUsers, totalDocuments, documentsByStatus] = await Promise.all([
      // Count total number of registered users
      User.countDocuments(),
      
      // Count total number of uploaded documents
      Document.countDocuments(),
      
      // Aggregate documents by status using MongoDB aggregation pipeline
      // Groups documents by their status field and counts each group
      Document.aggregate([
        {
          $group: {
            _id: "$status",      // Group by status field
            count: { $sum: 1 },  // Count documents in each group
          },
        },
      ]),
    ]);

    // Transform aggregation results into a simple object
    // Converts array of {_id: "status", count: number} to {status: count}
    const statusCounts = documentsByStatus.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Get recent documents with user information
    // Sorted by creation date (newest first), limited to 10
    // Populates userId field with user's name and email
    // Excludes sensitive S3 keys from response
    const recentDocuments = await Document.find()
      .sort({ createdAt: -1 })                    // Newest first
      .limit(10)                                  // Limit to 10 documents
      .populate("userId", "name email")           // Include user name and email
      .select("-s3Key");                          // Exclude sensitive S3 key

    // Return aggregated statistics and recent documents
    return NextResponse.json({
      stats: {
        totalUsers,                               // Total number of users
        totalDocuments,                           // Total number of documents
        statusCounts: {
          processing: statusCounts.processing || 0,  // Documents being processed
          completed: statusCounts.completed || 0,     // Documents successfully processed
          failed: statusCounts.failed || 0,            // Documents that failed processing
        },
      },
      recentDocuments: recentDocuments.map((doc) => ({
        id: doc._id,
        fileName: doc.fileName,
        userName: (doc.userId as any)?.name,      // User who uploaded the document
        userEmail: (doc.userId as any)?.email,    // User's email
        status: doc.status,                       // Document processing status
        uploadedAt: doc.uploadedAt,              // Upload timestamp
      })),
    });
  } catch (error: any) {
    // Log error for debugging and monitoring
    console.error("Admin dashboard error:", error);
    // Return generic error message to prevent information leakage
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
