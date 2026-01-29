import { NextRequest, NextResponse } from "next/server";
import { prisma, UserRole, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Update a user's role
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id: userId } = await params;

    const body = await request.json();
    const { role } = body as { role: string };

    // Validate role
    if (!role || !Object.values(UserRole).includes(role as UserRole)) {
      return NextResponse.json(
        { error: "Invalid role. Must be USER or ADMIN" },
        { status: 400 }
      );
    }

    // Prevent self-demotion (admin can't demote themselves)
    if (userId === admin.id && role !== "ADMIN") {
      return NextResponse.json(
        { error: "You cannot demote yourself" },
        { status: 400 }
      );
    }

    // Find the target user
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        handle: true,
        name: true,
        email: true,
        role: true,
        twitterSubject: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Update the user's role
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
      select: {
        id: true,
        handle: true,
        name: true,
        email: true,
        role: true,
        twitterSubject: true,
      },
    });

    // Log the action
    await prisma.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: AdminAction.UPDATE_ROLE,
        targetType: "User",
        targetId: userId,
        metadata: {
          previousRole: targetUser.role,
          newRole: role,
          targetHandle: targetUser.handle,
        },
      },
    });

    return NextResponse.json({
      success: true,
      user: {
        ...updatedUser,
        twitterId: updatedUser.twitterSubject,
      },
      message: `${updatedUser.handle || updatedUser.name || "User"} is now ${role}`,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating user role:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
