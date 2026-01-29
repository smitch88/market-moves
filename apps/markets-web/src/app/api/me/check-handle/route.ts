import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { prisma } from "@vault/database";

// Reserved handles that cannot be used
const RESERVED_HANDLES = [
  "admin",
  "api",
  "settings",
  "profile",
  "user",
  "users",
  "login",
  "logout",
  "signup",
  "register",
  "auth",
  "oauth",
  "callback",
  "help",
  "support",
  "about",
  "terms",
  "privacy",
  "faq",
  "leaderboard",
  "markets",
  "events",
  "sports",
  "null",
  "undefined",
  "me",
  "u",
];

/**
 * GET /api/me/check-handle?handle=username
 * 
 * Check if a handle is available for the current user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const handle = searchParams.get("handle");

    if (!handle) {
      return NextResponse.json(
        { error: "Handle parameter is required" },
        { status: 400 }
      );
    }

    // Validate format
    if (handle.length < 3) {
      return NextResponse.json({
        available: false,
        reason: "Username must be at least 3 characters",
      });
    }

    if (handle.length > 20) {
      return NextResponse.json({
        available: false,
        reason: "Username must be at most 20 characters",
      });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(handle)) {
      return NextResponse.json({
        available: false,
        reason: "Username can only contain letters, numbers, and underscores",
      });
    }

    // Check reserved words
    if (RESERVED_HANDLES.includes(handle.toLowerCase())) {
      return NextResponse.json({
        available: false,
        reason: "This username is reserved",
      });
    }

    // Check if it's the user's current handle
    if (user.handle?.toLowerCase() === handle.toLowerCase()) {
      return NextResponse.json({
        available: true,
        reason: "This is your current username",
      });
    }

    // Check if taken by another user
    const existingUser = await prisma.user.findFirst({
      where: {
        handle: {
          equals: handle,
          mode: "insensitive",
        },
        id: { not: user.id },
      },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json({
        available: false,
        reason: "This username is already taken",
      });
    }

    return NextResponse.json({
      available: true,
    });
  } catch (error) {
    console.error("Error checking handle availability:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
