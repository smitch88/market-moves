/**
 * Leaderboard Service
 *
 * Provides efficient leaderboard queries for XP and PnL rankings
 * with support for time-based filtering.
 */

import { prisma, BetStatus } from "@vault/database";
import { calculateLevel } from "./xp-service";

// ============================================================================
// TYPES
// ============================================================================

export type LeaderboardMetric = "xp" | "pnl";
export type LeaderboardPeriod = "all" | "monthly" | "weekly";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  value: number; // XP or PnL depending on metric
  level?: number; // Only for XP
}

export interface LeaderboardResult {
  entries: LeaderboardEntry[];
  metric: LeaderboardMetric;
  period: LeaderboardPeriod;
  totalUsers: number;
  updatedAt: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the start date for a time period
 */
function getPeriodStartDate(period: LeaderboardPeriod): Date | null {
  if (period === "all") return null;

  const now = new Date();
  if (period === "weekly") {
    return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  if (period === "monthly") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  return null;
}

// ============================================================================
// XP LEADERBOARD
// ============================================================================

/**
 * Get XP leaderboard
 * XP is cumulative, so we just query User.xp for all periods
 * For weekly/monthly, we aggregate from XPLedger
 */
export async function getXPLeaderboard(
  period: LeaderboardPeriod = "all",
  limit: number = 100
): Promise<LeaderboardEntry[]> {
  if (period === "all") {
    // All-time: Query User.xp directly (most efficient)
    const users = await prisma.user.findMany({
      where: { xp: { gt: 0 } },
      orderBy: { xp: "desc" },
      take: limit,
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        xp: true,
      },
    });

    return users.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      handle: user.handle,
      name: user.name,
      profileImageUrl: user.profileImageUrl,
      value: user.xp,
      level: calculateLevel(user.xp),
    }));
  }

  // Weekly/Monthly: Aggregate from XPLedger
  const startDate = getPeriodStartDate(period);
  if (!startDate) return [];

  const xpData = await prisma.xPLedger.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: startDate },
      delta: { gt: 0 }, // Only positive XP gains
    },
    _sum: { delta: true },
    orderBy: { _sum: { delta: "desc" } },
    take: limit,
  });

  // Get user details
  const userIds = xpData.map((x) => x.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      handle: true,
      name: true,
      profileImageUrl: true,
      xp: true, // Total XP for level calculation
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return xpData.map((entry, index) => {
    const user = userMap.get(entry.userId);
    return {
      rank: index + 1,
      userId: entry.userId,
      handle: user?.handle ?? null,
      name: user?.name ?? null,
      profileImageUrl: user?.profileImageUrl ?? null,
      value: entry._sum.delta ?? 0,
      level: user ? calculateLevel(user.xp) : 0,
    };
  });
}

// ============================================================================
// PNL LEADERBOARD
// ============================================================================

/**
 * Get PnL leaderboard
 * All-time: Query User.realizedPnL directly
 * Weekly/Monthly: Aggregate from Bet table
 */
export async function getPnLLeaderboard(
  period: LeaderboardPeriod = "all",
  limit: number = 100
): Promise<LeaderboardEntry[]> {
  if (period === "all") {
    // All-time: Query User.realizedPnL directly
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { realizedPnL: { gt: 0 } },
          { realizedPnL: { lt: 0 } },
        ],
      },
      orderBy: { realizedPnL: "desc" },
      take: limit,
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        realizedPnL: true,
      },
    });

    return users.map((user, index) => ({
      rank: index + 1,
      userId: user.id,
      handle: user.handle,
      name: user.name,
      profileImageUrl: user.profileImageUrl,
      value: Number(user.realizedPnL),
    }));
  }

  // Weekly/Monthly: Calculate PnL from settled bets
  const startDate = getPeriodStartDate(period);
  if (!startDate) return [];

  // Get all settled bets in the period
  const bets = await prisma.bet.findMany({
    where: {
      status: { in: [BetStatus.WON, BetStatus.LOST] },
      createdAt: { gte: startDate },
      payout: { not: null },
    },
    select: {
      userId: true,
      amount: true,
      payout: true,
      tradeType: true,
    },
  });

  // Aggregate PnL per user
  const pnlByUser = new Map<string, number>();
  for (const bet of bets) {
    // For buys: PnL = payout - amount
    // For sells: PnL is already realized at sell time
    if (bet.tradeType === "SELL") continue;

    const pnl = Number(bet.payout ?? 0) - Number(bet.amount);
    const current = pnlByUser.get(bet.userId) ?? 0;
    pnlByUser.set(bet.userId, current + pnl);
  }

  // Sort and get top users
  const sortedEntries = Array.from(pnlByUser.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  if (sortedEntries.length === 0) return [];

  // Get user details
  const userIds = sortedEntries.map(([userId]) => userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: {
      id: true,
      handle: true,
      name: true,
      profileImageUrl: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return sortedEntries.map(([userId, value], index) => {
    const user = userMap.get(userId);
    return {
      rank: index + 1,
      userId,
      handle: user?.handle ?? null,
      name: user?.name ?? null,
      profileImageUrl: user?.profileImageUrl ?? null,
      value: Math.round(value), // Round to whole cents
    };
  });
}

// ============================================================================
// COMBINED LEADERBOARD
// ============================================================================

/**
 * Get leaderboard for any metric and period
 */
export async function getLeaderboard(
  metric: LeaderboardMetric,
  period: LeaderboardPeriod = "all",
  limit: number = 100
): Promise<LeaderboardResult> {
  const entries =
    metric === "xp"
      ? await getXPLeaderboard(period, limit)
      : await getPnLLeaderboard(period, limit);

  // Get total user count with activity
  const totalUsers = await prisma.user.count({
    where: metric === "xp" ? { xp: { gt: 0 } } : { realizedPnL: { not: 0 } },
  });

  return {
    entries,
    metric,
    period,
    totalUsers,
    updatedAt: new Date().toISOString(),
  };
}
