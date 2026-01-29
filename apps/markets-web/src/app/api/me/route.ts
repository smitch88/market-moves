import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { prisma } from "@vault/database";
import { z } from "zod";

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

// Validation schema for profile updates
const updateProfileSchema = z.object({
  handle: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    )
    .refine(
      (val) => !RESERVED_HANDLES.includes(val.toLowerCase()),
      "This username is reserved"
    )
    .optional()
    .nullable(),
  name: z
    .string()
    .max(50, "Display name must be at most 50 characters")
    .optional()
    .nullable(),
  profileImageUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
});

export async function GET() {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PATCH /api/me
 * 
 * Update the current user's profile.
 * Allowed fields: handle, name, profileImageUrl
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = updateProfileSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { handle, name, profileImageUrl } = validation.data;

    // Check if handle is being updated and if it's unique
    if (handle !== undefined && handle !== null && handle !== user.handle) {
      const existingUser = await prisma.user.findFirst({
        where: {
          handle: {
            equals: handle,
            mode: "insensitive",
          },
          id: { not: user.id },
        },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: "This username is already taken" },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: {
      handle?: string | null;
      name?: string | null;
      profileImageUrl?: string | null;
    } = {};

    if (handle !== undefined) {
      updateData.handle = handle || null;
    }
    if (name !== undefined) {
      updateData.name = name || null;
    }
    if (profileImageUrl !== undefined) {
      updateData.profileImageUrl = profileImageUrl || null;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: updateData,
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        email: true,
        createdAt: true,
        xp: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Error updating user profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
