/**
 * Leaderboard Service
 *
 * Provides efficient leaderboard queries for XP and PnL rankings
 * with support for time-based filtering and pagination.
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
  page: number;
  pageSize: number;
  totalUsers: number;
  totalPages: number;
  updatedAt: string;
}

export interface UserRankResult {
  rank: number;
  value: number;
  level?: number;
  totalUsers: number;
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
 * Get XP leaderboard with pagination
 */
export async function getXPLeaderboard(
  period: LeaderboardPeriod = "all",
  page: number = 1,
  pageSize: number = 25
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const skip = (page - 1) * pageSize;

  if (period === "all") {
    // All-time: Query User.xp directly (most efficient)
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: { xp: { gt: 0 } },
        orderBy: { xp: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          handle: true,
          name: true,
          profileImageUrl: true,
          xp: true,
        },
      }),
      prisma.user.count({ where: { xp: { gt: 0 } } }),
    ]);

    const entries = users.map((user, index) => ({
      rank: skip + index + 1,
      userId: user.id,
      handle: user.handle,
      name: user.name,
      profileImageUrl: user.profileImageUrl,
      value: user.xp,
      level: calculateLevel(user.xp),
    }));

    return { entries, total };
  }

  // Weekly/Monthly: Aggregate from XPLedger
  const startDate = getPeriodStartDate(period);
  if (!startDate) return { entries: [], total: 0 };

  // Get total count first
  const totalResult = await prisma.xPLedger.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: startDate },
      delta: { gt: 0 },
    },
    _count: true,
  });
  const total = totalResult.length;

  // Get paginated data
  const xpData = await prisma.xPLedger.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: startDate },
      delta: { gt: 0 },
    },
    _sum: { delta: true },
    orderBy: { _sum: { delta: "desc" } },
    skip,
    take: pageSize,
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
      xp: true,
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  const entries = xpData.map((entry, index) => {
    const user = userMap.get(entry.userId);
    return {
      rank: skip + index + 1,
      userId: entry.userId,
      handle: user?.handle ?? null,
      name: user?.name ?? null,
      profileImageUrl: user?.profileImageUrl ?? null,
      value: entry._sum.delta ?? 0,
      level: user ? calculateLevel(user.xp) : 0,
    };
  });

  return { entries, total };
}

/**
 * Get a user's XP rank
 */
export async function getUserXPRank(
  userId: string,
  period: LeaderboardPeriod = "all"
): Promise<UserRankResult | null> {
  if (period === "all") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true },
    });

    if (!user || user.xp <= 0) return null;

    const rank = await prisma.user.count({
      where: { xp: { gt: user.xp } },
    });

    const total = await prisma.user.count({ where: { xp: { gt: 0 } } });

    return {
      rank: rank + 1,
      value: user.xp,
      level: calculateLevel(user.xp),
      totalUsers: total,
    };
  }

  // For weekly/monthly, we need to aggregate
  const startDate = getPeriodStartDate(period);
  if (!startDate) return null;

  const userXP = await prisma.xPLedger.aggregate({
    where: {
      userId,
      createdAt: { gte: startDate },
      delta: { gt: 0 },
    },
    _sum: { delta: true },
  });

  const userValue = userXP._sum.delta ?? 0;
  if (userValue <= 0) return null;

  // Count users with more XP in the period
  const allUserXP = await prisma.xPLedger.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: startDate },
      delta: { gt: 0 },
    },
    _sum: { delta: true },
  });

  const rank = allUserXP.filter((u) => (u._sum.delta ?? 0) > userValue).length + 1;
  const total = allUserXP.length;

  // Get user's total XP for level
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true },
  });

  return {
    rank,
    value: userValue,
    level: user ? calculateLevel(user.xp) : 0,
    totalUsers: total,
  };
}

// ============================================================================
// PNL LEADERBOARD
// ============================================================================

/**
 * Get PnL leaderboard with pagination
 */
export async function getPnLLeaderboard(
  period: LeaderboardPeriod = "all",
  page: number = 1,
  pageSize: number = 25
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const skip = (page - 1) * pageSize;

  if (period === "all") {
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          OR: [{ realizedPnL: { gt: 0 } }, { realizedPnL: { lt: 0 } }],
        },
        orderBy: { realizedPnL: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          handle: true,
          name: true,
          profileImageUrl: true,
          realizedPnL: true,
        },
      }),
      prisma.user.count({
        where: {
          OR: [{ realizedPnL: { gt: 0 } }, { realizedPnL: { lt: 0 } }],
        },
      }),
    ]);

    const entries = users.map((user, index) => ({
      rank: skip + index + 1,
      userId: user.id,
      handle: user.handle,
      name: user.name,
      profileImageUrl: user.profileImageUrl,
      value: Number(user.realizedPnL),
    }));

    return { entries, total };
  }

  // Weekly/Monthly: Calculate PnL from settled bets
  const startDate = getPeriodStartDate(period);
  if (!startDate) return { entries: [], total: 0 };

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
    if (bet.tradeType === "SELL") continue;
    const pnl = Number(bet.payout ?? 0) - Number(bet.amount);
    const current = pnlByUser.get(bet.userId) ?? 0;
    pnlByUser.set(bet.userId, current + pnl);
  }

  // Sort and paginate
  const sortedEntries = Array.from(pnlByUser.entries())
    .sort((a, b) => b[1] - a[1]);
  
  const total = sortedEntries.length;
  const paginatedEntries = sortedEntries.slice(skip, skip + pageSize);

  if (paginatedEntries.length === 0) return { entries: [], total };

  // Get user details
  const userIds = paginatedEntries.map(([userId]) => userId);
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

  const entries = paginatedEntries.map(([userId, value], index) => {
    const user = userMap.get(userId);
    return {
      rank: skip + index + 1,
      userId,
      handle: user?.handle ?? null,
      name: user?.name ?? null,
      profileImageUrl: user?.profileImageUrl ?? null,
      value: Math.round(value),
    };
  });

  return { entries, total };
}

/**
 * Get a user's PnL rank
 */
export async function getUserPnLRank(
  userId: string,
  period: LeaderboardPeriod = "all"
): Promise<UserRankResult | null> {
  if (period === "all") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { realizedPnL: true },
    });

    if (!user) return null;
    const userValue = Number(user.realizedPnL);
    if (userValue === 0) return null;

    const rank = await prisma.user.count({
      where: { realizedPnL: { gt: user.realizedPnL } },
    });

    const total = await prisma.user.count({
      where: {
        OR: [{ realizedPnL: { gt: 0 } }, { realizedPnL: { lt: 0 } }],
      },
    });

    return {
      rank: rank + 1,
      value: userValue,
      totalUsers: total,
    };
  }

  // For weekly/monthly, aggregate from bets
  const startDate = getPeriodStartDate(period);
  if (!startDate) return null;

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

  const pnlByUser = new Map<string, number>();
  for (const bet of bets) {
    if (bet.tradeType === "SELL") continue;
    const pnl = Number(bet.payout ?? 0) - Number(bet.amount);
    const current = pnlByUser.get(bet.userId) ?? 0;
    pnlByUser.set(bet.userId, current + pnl);
  }

  const userValue = pnlByUser.get(userId);
  if (userValue === undefined || userValue === 0) return null;

  const rank = Array.from(pnlByUser.values()).filter((v) => v > userValue).length + 1;
  const total = pnlByUser.size;

  return {
    rank,
    value: Math.round(userValue),
    totalUsers: total,
  };
}

// ============================================================================
// COMBINED LEADERBOARD
// ============================================================================

/**
 * Get leaderboard for any metric and period with pagination
 */
export async function getLeaderboard(
  metric: LeaderboardMetric,
  period: LeaderboardPeriod = "all",
  page: number = 1,
  pageSize: number = 25
): Promise<LeaderboardResult> {
  const { entries, total } =
    metric === "xp"
      ? await getXPLeaderboard(period, page, pageSize)
      : await getPnLLeaderboard(period, page, pageSize);

  return {
    entries,
    metric,
    period,
    page,
    pageSize,
    totalUsers: total,
    totalPages: Math.ceil(total / pageSize),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Get a user's rank for a given metric and period
 */
export async function getUserRank(
  userId: string,
  metric: LeaderboardMetric,
  period: LeaderboardPeriod = "all"
): Promise<UserRankResult | null> {
  return metric === "xp"
    ? getUserXPRank(userId, period)
    : getUserPnLRank(userId, period);
}

/**
 * Get user's leaderboard entry with their details
 */
export async function getUserLeaderboardEntry(
  userId: string,
  metric: LeaderboardMetric,
  period: LeaderboardPeriod = "all"
): Promise<LeaderboardEntry | null> {
  const rankResult = await getUserRank(userId, metric, period);
  if (!rankResult) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      handle: true,
      name: true,
      profileImageUrl: true,
    },
  });

  if (!user) return null;

  return {
    rank: rankResult.rank,
    userId: user.id,
    handle: user.handle,
    name: user.name,
    profileImageUrl: user.profileImageUrl,
    value: rankResult.value,
    level: rankResult.level,
  };
}
