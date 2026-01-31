import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { grantKOLStatus, revokeKOLStatus } from "@/lib/services/kol-service";

/**
 * POST /api/admin/users/[id]/kol
 * Grant KOL status to a user
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id: userId } = await params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isKOL: true, handle: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.isKOL) {
      return NextResponse.json(
        { error: "User is already a KOL" },
        { status: 400 }
      );
    }

    // Grant KOL status
    await grantKOLStatus(userId, admin.id);

    // Log admin action
    await prisma.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: AdminAction.USER_KOL_GRANT,
        targetType: "User",
        targetId: userId,
        metadata: {
          userHandle: user.handle,
          userName: user.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `KOL status granted to ${user.handle || user.name || userId}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error granting KOL status:", error);
    return NextResponse.json(
      { error: "Failed to grant KOL status" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/users/[id]/kol
 * Revoke KOL status from a user
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id: userId } = await params;

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isKOL: true, handle: true, name: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.isKOL) {
      return NextResponse.json(
        { error: "User is not a KOL" },
        { status: 400 }
      );
    }

    // Revoke KOL status
    await revokeKOLStatus(userId);

    // Log admin action
    await prisma.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: AdminAction.USER_KOL_REVOKE,
        targetType: "User",
        targetId: userId,
        metadata: {
          userHandle: user.handle,
          userName: user.name,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `KOL status revoked from ${user.handle || user.name || userId}`,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Forbidden") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error revoking KOL status:", error);
    return NextResponse.json(
      { error: "Failed to revoke KOL status" },
      { status: 500 }
    );
  }
}
