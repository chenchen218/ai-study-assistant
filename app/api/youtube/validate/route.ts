/**
 * YouTube Video Validation API Route
 * 
 * Validates a YouTube URL and fetches video metadata using YouTube Data API.
 * Also checks daily usage limits and video duration restrictions.
 * 
 * @route POST /api/youtube/validate
 * @access Protected (requires authentication)
 */

import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/db";
import { getUserIdFromRequest } from "@/lib/auth";
import { Document } from "@/models/Document";

// YouTube API configuration
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

// Limits
const DAILY_LIMIT = 3; // Maximum videos per user per day
const MAX_DURATION_SECONDS = 60 * 60; // 60 minutes in seconds

// Educational category IDs from YouTube
const EDUCATIONAL_CATEGORIES = ["27", "28", "26"]; // Education, Science & Tech, Howto & Style

// Educational keywords to check in title/description
const EDUCATIONAL_KEYWORDS = [
  "lecture", "course", "tutorial", "lesson", "class", "seminar",
  "education", "learn", "study", "academic", "university", "college",
  "professor", "teacher", "training", "workshop", "webinar",
  "explained", "introduction", "guide", "how to", "basics",
  // Chinese keywords
  "课程", "讲座", "教程", "学习", "教学", "大学", "教授"
];

/**
 * Extracts YouTube video ID from various URL formats
 * Supports: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, etc.
 */
function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

/**
 * Converts ISO 8601 duration to seconds
 * Example: "PT1H30M45S" -> 5445 seconds
 */
function parseDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Formats duration in seconds to human-readable string
 */
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Checks if video content appears to be educational based on metadata
 */
function checkIfEducational(
  title: string, 
  description: string, 
  categoryId: string,
  tags: string[] = []
): { isEducational: boolean; confidence: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];

  // Check category (high weight)
  if (EDUCATIONAL_CATEGORIES.includes(categoryId)) {
    score += 40;
    reasons.push("Educational category");
  }

  // Check title for educational keywords
  const titleLower = title.toLowerCase();
  const titleMatches = EDUCATIONAL_KEYWORDS.filter(kw => titleLower.includes(kw.toLowerCase()));
  if (titleMatches.length > 0) {
    score += Math.min(30, titleMatches.length * 15);
    reasons.push(`Title contains: ${titleMatches.slice(0, 3).join(", ")}`);
  }

  // Check description for educational keywords
  const descLower = (description || "").toLowerCase();
  const descMatches = EDUCATIONAL_KEYWORDS.filter(kw => descLower.includes(kw.toLowerCase()));
  if (descMatches.length > 0) {
    score += Math.min(20, descMatches.length * 5);
    reasons.push("Description contains educational terms");
  }

  // Check tags
  const tagMatches = tags.filter(tag => 
    EDUCATIONAL_KEYWORDS.some(kw => tag.toLowerCase().includes(kw.toLowerCase()))
  );
  if (tagMatches.length > 0) {
    score += Math.min(10, tagMatches.length * 5);
    reasons.push("Tags indicate educational content");
  }

  const confidence = Math.min(100, score);
  const isEducational = confidence >= 30;

  return {
    isEducational,
    confidence,
    reason: reasons.length > 0 ? reasons.join("; ") : "No educational indicators found"
  };
}

/**
 * Gets today's YouTube video count for a user
 */
async function getTodayUsageCount(userId: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const count = await Document.countDocuments({
    userId: new mongoose.Types.ObjectId(userId),
    fileType: "youtube",
    createdAt: { $gte: today }
  });
  
  return count;
}

export async function POST(request: NextRequest) {
  try {
    // Check API key configuration
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: "YouTube API is not configured" },
        { status: 500 }
      );
    }

    await connectDB();

    // Authenticate user
    const userId = getUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get URL from request body
    const { url } = await request.json();
    if (!url) {
      return NextResponse.json(
        { error: "YouTube URL is required" },
        { status: 400 }
      );
    }

    // Extract video ID
    const videoId = extractVideoId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Invalid YouTube URL format" },
        { status: 400 }
      );
    }

    // Check daily usage limit
    const todayCount = await getTodayUsageCount(userId);
    const remaining = DAILY_LIMIT - todayCount;
    
    if (remaining <= 0) {
      return NextResponse.json(
        { 
          error: "Daily limit reached",
          message: `You have used all ${DAILY_LIMIT} YouTube videos for today. Try again tomorrow.`,
          dailyLimit: DAILY_LIMIT,
          remaining: 0
        },
        { status: 429 }
      );
    }

    // Fetch video details from YouTube API
    const apiUrl = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${YOUTUBE_API_KEY}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      const errorData = await response.json();
      console.error("YouTube API error:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch video information from YouTube" },
        { status: 502 }
      );
    }

    const data = await response.json();
    
    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { error: "Video not found or is private" },
        { status: 404 }
      );
    }

    const video = data.items[0];
    const snippet = video.snippet;
    const contentDetails = video.contentDetails;

    // Parse duration
    const durationSeconds = parseDuration(contentDetails.duration);
    const durationFormatted = formatDuration(durationSeconds);

    // Check duration limit
    if (durationSeconds > MAX_DURATION_SECONDS) {
      return NextResponse.json(
        { 
          error: "Video too long",
          message: `Video duration (${durationFormatted}) exceeds the maximum allowed (${formatDuration(MAX_DURATION_SECONDS)}).`,
          duration: durationSeconds,
          maxDuration: MAX_DURATION_SECONDS
        },
        { status: 400 }
      );
    }

    // Check if educational
    const educationalCheck = checkIfEducational(
      snippet.title,
      snippet.description,
      snippet.categoryId,
      snippet.tags || []
    );

    // Get best thumbnail
    const thumbnails = snippet.thumbnails;
    const thumbnail = thumbnails.maxres?.url || 
                      thumbnails.high?.url || 
                      thumbnails.medium?.url || 
                      thumbnails.default?.url;

    // Return validation result
    return NextResponse.json({
      valid: true,
      videoId,
      title: snippet.title,
      channelTitle: snippet.channelTitle,
      description: snippet.description?.substring(0, 500),
      thumbnail,
      duration: durationSeconds,
      durationFormatted,
      categoryId: snippet.categoryId,
      publishedAt: snippet.publishedAt,
      viewCount: video.statistics?.viewCount,
      isEducational: educationalCheck.isEducational,
      educationalConfidence: educationalCheck.confidence,
      educationalReason: educationalCheck.reason,
      dailyLimit: DAILY_LIMIT,
      remaining: remaining,
      maxDuration: MAX_DURATION_SECONDS,
      maxDurationFormatted: formatDuration(MAX_DURATION_SECONDS)
    });

  } catch (error: any) {
    console.error("YouTube validation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to validate YouTube URL" },
      { status: 500 }
    );
  }
}

