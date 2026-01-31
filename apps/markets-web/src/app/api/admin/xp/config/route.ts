import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import {
  getXPConfig,
  getAllXPConfig,
  setXPConfigValue,
  invalidateXPConfigCache,
  getXPStats,
  getDailyXPStats,
} from "@/lib/services/xp-service";
import { z } from "zod";

/**
 * GET /api/admin/xp/config
 * 
 * Get all XP configuration values and stats
 */
export async function GET() {
  try {
    await requireAdmin();

    const [config, allConfigRaw, stats, dailyStats] = await Promise.all([
      getXPConfig(),
      getAllXPConfig(),
      getXPStats(),
      getDailyXPStats(7),
    ]);

    return NextResponse.json({
      config,
      allConfigRaw,
      stats,
      dailyStats,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching XP config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const updateConfigSchema = z.object({
  key: z.enum([
    "xp_per_dollar_volume",
    "daily_xp_cap",
    "market_cooldown_seconds",
    "market_volume_threshold",
    "share_bonus_percent",
  ]),
  value: z.number().int().min(0),
});

const updateAllConfigSchema = z.object({
  xpPerDollar: z.number().int().min(1).max(100).optional(),
  dailyXpCap: z.number().int().min(1000).max(1000000).optional(),
  marketCooldownSeconds: z.number().int().min(0).max(3600).optional(),
  marketVolumeThreshold: z.number().int().min(10).max(100000).optional(),
  shareBonusPercent: z.number().int().min(0).max(100).optional(),
});

/**
 * POST /api/admin/xp/config
 * 
 * Update XP configuration values
 * 
 * Body can be either:
 * - { key: string, value: number } to update a single config
 * - { xpPerDollar, dailyXpCap, marketCooldownSeconds, maxTradesPerMarketPerDay } to update multiple
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();

    // Try parsing as single update first
    const singleParse = updateConfigSchema.safeParse(body);
    if (singleParse.success) {
      const { key, value } = singleParse.data;
      
      const descriptions: Record<string, string> = {
        xp_per_dollar_volume: "XP awarded per $1 of trading volume",
        daily_xp_cap: "Maximum XP a user can earn per day from trading",
        market_cooldown_seconds: "Cooldown period (seconds) before earning XP again in the same market",
        market_volume_threshold: "Volume per tier before diminishing returns kick in (in dollars)",
        share_bonus_percent: "Percentage of bet amount awarded as XP bonus for sharing (0-100)",
      };

      await setXPConfigValue(key, value, descriptions[key] || "", admin.id);

      return NextResponse.json({
        success: true,
        updated: { [key]: value },
      });
    }

    // Try parsing as bulk update
    const bulkParse = updateAllConfigSchema.safeParse(body);
    if (bulkParse.success) {
      const { xpPerDollar, dailyXpCap, marketCooldownSeconds, marketVolumeThreshold, shareBonusPercent } = bulkParse.data;
      
      const updates: Record<string, number> = {};

      if (xpPerDollar !== undefined) {
        await setXPConfigValue(
          "xp_per_dollar_volume",
          xpPerDollar,
          "XP awarded per $1 of trading volume",
          admin.id
        );
        updates.xpPerDollar = xpPerDollar;
      }

      if (dailyXpCap !== undefined) {
        await setXPConfigValue(
          "daily_xp_cap",
          dailyXpCap,
          "Maximum XP a user can earn per day from trading",
          admin.id
        );
        updates.dailyXpCap = dailyXpCap;
      }

      if (marketCooldownSeconds !== undefined) {
        await setXPConfigValue(
          "market_cooldown_seconds",
          marketCooldownSeconds,
          "Cooldown period (seconds) before earning XP again in the same market",
          admin.id
        );
        updates.marketCooldownSeconds = marketCooldownSeconds;
      }

      if (marketVolumeThreshold !== undefined) {
        await setXPConfigValue(
          "market_volume_threshold",
          marketVolumeThreshold,
          "Volume per tier before diminishing returns kick in (in dollars)",
          admin.id
        );
        updates.marketVolumeThreshold = marketVolumeThreshold;
      }

      if (shareBonusPercent !== undefined) {
        await setXPConfigValue(
          "share_bonus_percent",
          shareBonusPercent,
          "Percentage of bet amount awarded as XP bonus for sharing (0-100)",
          admin.id
        );
        updates.shareBonusPercent = shareBonusPercent;
      }

      // Invalidate cache after all updates
      invalidateXPConfigCache();

      // Get updated config
      const newConfig = await getXPConfig();

      return NextResponse.json({
        success: true,
        updated: updates,
        config: newConfig,
      });
    }

    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating XP config:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
