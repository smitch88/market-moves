import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";
import { getXPRate, setXPRate, getAllXPConfig, getXPStats, invalidateXPRateCache } from "@/lib/services/xp-service";

const updateConfigSchema = z.object({
  xp_per_dollar_volume: z.number().int().min(0).max(1000).optional(),
});

/**
 * GET /api/admin/config/xp
 * 
 * Get current XP configuration settings
 */
export async function GET() {
  try {
    await requireAdmin();

    const [allConfig, xpRate, stats] = await Promise.all([
      getAllXPConfig(),
      getXPRate(),
      getXPStats(),
    ]);

    return NextResponse.json({
      xp_per_dollar_volume: xpRate,
      all_settings: allConfig.map((c) => ({
        key: c.key,
        value: c.value,
        description: c.description,
        updatedAt: c.updatedAt.toISOString(),
      })),
      stats: {
        totalXPAwarded: stats.totalXPAwarded,
        usersWithXP: stats.usersWithXP,
        averageXP: stats.averageXP,
        medianLevel: stats.medianLevel,
      },
    });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching XP config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT /api/admin/config/xp
 * 
 * Update XP configuration settings
 */
export async function PUT(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const updates = updateConfigSchema.parse(body);

    const changes: { key: string; oldValue: string; newValue: string }[] = [];

    if (updates.xp_per_dollar_volume !== undefined) {
      const oldRate = await getXPRate();
      await setXPRate(updates.xp_per_dollar_volume, admin.id);
      changes.push({
        key: "xp_per_dollar_volume",
        oldValue: String(oldRate),
        newValue: String(updates.xp_per_dollar_volume),
      });
    }

    if (changes.length > 0) {
      // Log admin action
      await prisma.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.CONFIG_UPDATE,
          targetType: "XPConfig",
          targetId: "xp_settings",
          metadata: {
            changes,
          },
        },
      });
    }

    // Return updated config
    const allConfig = await getAllXPConfig();
    const xpRate = await getXPRate();

    return NextResponse.json({
      success: true,
      changes,
      config: {
        xp_per_dollar_volume: xpRate,
        all_settings: allConfig.map((c) => ({
          key: c.key,
          value: c.value,
          description: c.description,
          updatedAt: c.updatedAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating XP config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
