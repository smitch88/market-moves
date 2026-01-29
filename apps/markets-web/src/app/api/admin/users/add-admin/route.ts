import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";

// Add a new admin by Twitter subject/ID or handle
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();

    const body = await request.json();
    const { twitterId, handle } = body as { twitterId?: string; handle?: string };

    if (!twitterId && !handle) {
      return NextResponse.json(
        { error: "Twitter ID or handle is required" },
        { status: 400 }
      );
    }

    // Build where clause - search by twitterSubject or handle
    const whereConditions = [];
    if (twitterId) {
      whereConditions.push({ twitterSubject: twitterId });
    }
    if (handle) {
      whereConditions.push({ handle: handle.replace("@", "") });
    }

    // Find user by Twitter subject or handle
    const user = await prisma.user.findFirst({
      where: {
        OR: whereConditions,
      },
      select: {
        id: true,
        handle: true,
        name: true,
        email: true,
        role: true,
        twitterSubject: true,
        profileImageUrl: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { 
          error: "No user found. The user must sign up on the platform first before being made an admin.",
          searched: { twitterId, handle }
        },
        { status: 404 }
      );
    }

    if (user.role === "ADMIN") {
      return NextResponse.json(
        { error: `${user.handle || user.name || "User"} is already an admin` },
        { status: 400 }
      );
    }

    // Update the user's role to ADMIN
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: "ADMIN" },
      select: {
        id: true,
        handle: true,
        name: true,
        email: true,
        role: true,
        twitterSubject: true,
        profileImageUrl: true,
      },
    });

    // Log the action
    await prisma.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: AdminAction.ADD_ADMIN,
        targetType: "User",
        targetId: user.id,
        metadata: {
          newAdminHandle: updatedUser.handle,
          newAdminTwitterId: updatedUser.twitterSubject,
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        avatarUrl: updatedUser.profileImageUrl,
        twitterId: updatedUser.twitterSubject,
      },
      message: `@${updatedUser.handle || updatedUser.name || "User"} is now an admin`,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error adding admin:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
