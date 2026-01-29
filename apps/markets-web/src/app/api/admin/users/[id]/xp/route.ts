import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction, XPReason } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";
import { adjustXP, getUserXPInfo, getXPHistory, calculateLevel } from "@/lib/services/xp-service";

const adjustXPSchema = z.object({
  delta: z.number().int(), // Can be positive or negative
  reason: z.enum(["ADMIN_ADJUST", "BONUS", "PENALTY"]),
  note: z.string().max(500).optional(),
});

/**
 * GET /api/admin/users/[id]/xp
 * 
 * Get a user's XP information and recent history
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        handle: true,
        name: true,
        xp: true,
        totalVolume: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const xpInfo = await getUserXPInfo(id);
    const history = await getXPHistory(id, 20);

    return NextResponse.json({
      user: {
        id: user.id,
        handle: user.handle,
        name: user.name,
        totalVolume: Number(user.totalVolume),
      },
      xp: xpInfo,
      history: history.entries.map((entry) => ({
        ...entry,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching user XP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * POST /api/admin/users/[id]/xp
 * 
 * Adjust a user's XP (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const { delta, reason, note } = adjustXPSchema.parse(body);

    if (delta === 0) {
      return NextResponse.json({ error: "Delta cannot be zero" }, { status: 400 });
    }

    // Get user info before adjustment
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, handle: true, name: true, xp: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Map string reason to enum
    const xpReason = XPReason[reason as keyof typeof XPReason];

    // Perform the XP adjustment
    const { xpBefore, xpAfter } = await adjustXP(
      id,
      delta,
      xpReason,
      admin.id
    );

    const levelBefore = calculateLevel(xpBefore);
    const levelAfter = calculateLevel(xpAfter);

    // Log admin action
    await prisma.adminActionLog.create({
      data: {
        adminUserId: admin.id,
        action: AdminAction.USER_XP_ADJUST,
        targetType: "User",
        targetId: id,
        metadata: {
          delta,
          xpBefore,
          xpAfter,
          levelBefore,
          levelAfter,
          reason,
          note,
        },
      },
    });

    return NextResponse.json({
      success: true,
      userId: id,
      userHandle: user.handle,
      userName: user.name,
      delta,
      xpBefore,
      xpAfter,
      levelBefore,
      levelAfter,
      reason,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "User not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error adjusting XP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
