/**
 * Leaderboard Service
 *
 * Provides efficient leaderboard queries for XP and PnL rankings
 * with support for time-based filtering and pagination.
 * 
 * PnL includes both realized (from settled bets) and unrealized
 * (from current open positions) for a complete picture.
 */

import { prisma, BetStatus } from "@vault/database";
import { calculateLevel } from "./xp-service";

// ============================================================================
// TYPES
// ============================================================================

export type LeaderboardMetric = "xp" | "pnl" | "volume";
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
// VOLUME LEADERBOARD
// ============================================================================

/**
 * Get Volume leaderboard with pagination
 * Uses User.totalVolume for all-time, or aggregates from Bet for time periods
 */
export async function getVolumeLeaderboard(
  period: LeaderboardPeriod = "all",
  page: number = 1,
  pageSize: number = 25
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const skip = (page - 1) * pageSize;

  if (period === "all") {
    // Use stored totalVolume for efficiency
    const total = await prisma.user.count({
      where: { totalVolume: { gt: 0 } },
    });

    const users = await prisma.user.findMany({
      where: { totalVolume: { gt: 0 } },
      orderBy: { totalVolume: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        totalVolume: true,
        xp: true,
      },
    });

    const entries = users.map((user, index) => ({
      rank: skip + index + 1,
      userId: user.id,
      handle: user.handle,
      name: user.name,
      profileImageUrl: user.profileImageUrl,
      value: Number(user.totalVolume),
      level: calculateLevel(user.xp),
    }));

    return { entries, total };
  }

  // For weekly/monthly, aggregate from bets
  const startDate = getPeriodStartDate(period);
  if (!startDate) {
    return { entries: [], total: 0 };
  }

  // Count unique users with volume in period
  const volumeData = await prisma.bet.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: startDate },
      status: BetStatus.CONFIRMED,
    },
    _sum: { amount: true },
  });

  const total = volumeData.filter((v) => Number(v._sum.amount ?? 0) > 0).length;

  // Sort and paginate
  const sortedData = volumeData
    .map((v) => ({ userId: v.userId, volume: Number(v._sum.amount ?? 0) }))
    .filter((v) => v.volume > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(skip, skip + pageSize);

  // Get user details
  const userIds = sortedData.map((x) => x.userId);
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

  const entries = sortedData.map((entry, index) => {
    const user = userMap.get(entry.userId);
    return {
      rank: skip + index + 1,
      userId: entry.userId,
      handle: user?.handle ?? null,
      name: user?.name ?? null,
      profileImageUrl: user?.profileImageUrl ?? null,
      value: entry.volume,
      level: user ? calculateLevel(user.xp) : 0,
    };
  });

  return { entries, total };
}

/**
 * Get a user's Volume rank
 */
export async function getUserVolumeRank(
  userId: string,
  period: LeaderboardPeriod = "all"
): Promise<UserRankResult | null> {
  if (period === "all") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { totalVolume: true, xp: true },
    });

    if (!user || Number(user.totalVolume) <= 0) return null;

    const userVolume = Number(user.totalVolume);
    const rank = await prisma.user.count({
      where: { totalVolume: { gt: user.totalVolume } },
    });

    const total = await prisma.user.count({ where: { totalVolume: { gt: 0 } } });

    return {
      rank: rank + 1,
      value: userVolume,
      level: calculateLevel(user.xp),
      totalUsers: total,
    };
  }

  // For weekly/monthly, aggregate from bets
  const startDate = getPeriodStartDate(period);
  if (!startDate) return null;

  const userVolume = await prisma.bet.aggregate({
    where: {
      userId,
      createdAt: { gte: startDate },
      status: BetStatus.CONFIRMED,
    },
    _sum: { amount: true },
  });

  const userValue = Number(userVolume._sum.amount ?? 0);
  if (userValue <= 0) return null;

  // Get all users' volumes for the period
  const allVolumes = await prisma.bet.groupBy({
    by: ["userId"],
    where: {
      createdAt: { gte: startDate },
      status: BetStatus.CONFIRMED,
    },
    _sum: { amount: true },
  });

  const rank = allVolumes.filter((u) => Number(u._sum.amount ?? 0) > userValue).length + 1;
  const total = allVolumes.filter((u) => Number(u._sum.amount ?? 0) > 0).length;

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
 * Calculate unrealized PnL for a position
 * Handles OPEN/PUBLISHED markets (current prices) and RESOLVED/SETTLED markets (known outcome)
 */
function calculatePositionUnrealizedPnL(position: {
  shares0: unknown;
  shares1: unknown;
  avgCost0: unknown;
  avgCost1: unknown;
  market: {
    status: string;
    reserve0: unknown;
    reserve1: unknown;
    resolvedOutcome?: number | null;
    feeBps?: number;
  };
}): number {
  const shares0 = Number(position.shares0);
  const shares1 = Number(position.shares1);
  const avgCost0 = Number(position.avgCost0);
  const avgCost1 = Number(position.avgCost1);

  // Skip if no shares
  if (shares0 <= 0 && shares1 <= 0) return 0;

  let unrealizedPnL = 0;
  const { market } = position;

  if (market.status === "RESOLVED" || market.status === "SETTLED") {
    // For resolved/settled markets, winning shares = $1 (minus fee), losing = $0
    const fee = (market.feeBps || 0) / 10000;
    const winningOutcome = market.resolvedOutcome;

    if (winningOutcome === 0) {
      const currentValue = shares0 * (1 - fee);
      unrealizedPnL += currentValue - shares0 * avgCost0;
      unrealizedPnL -= shares1 * avgCost1; // Lost
    } else if (winningOutcome === 1) {
      const currentValue = shares1 * (1 - fee);
      unrealizedPnL += currentValue - shares1 * avgCost1;
      unrealizedPnL -= shares0 * avgCost0; // Lost
    }
  } else if (market.status === "OPEN" || market.status === "PUBLISHED") {
    const reserve0 = Number(market.reserve0);
    const reserve1 = Number(market.reserve1);
    const totalReserve = reserve0 + reserve1;

    if (totalReserve === 0) return 0;

    const price0 = reserve1 / totalReserve;
    const price1 = reserve0 / totalReserve;

    if (shares0 > 0) {
      unrealizedPnL += shares0 * price0 - shares0 * avgCost0;
    }
    if (shares1 > 0) {
      unrealizedPnL += shares1 * price1 - shares1 * avgCost1;
    }
  }

  return unrealizedPnL;
}

/**
 * Get PnL leaderboard with pagination
 * For "all" period: includes both realized and unrealized PnL
 * For weekly/monthly: only realized PnL from settled bets in that period
 */
export async function getPnLLeaderboard(
  period: LeaderboardPeriod = "all",
  page: number = 1,
  pageSize: number = 25
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  const skip = (page - 1) * pageSize;

  if (period === "all") {
    // Get all users with positions or realized PnL
    const usersWithActivity = await prisma.user.findMany({
      where: {
        OR: [
          { realizedPnL: { not: 0 } },
          {
            positions: {
              some: {
                claimedAt: null,
                OR: [{ shares0: { gt: 0 } }, { shares1: { gt: 0 } }],
              },
            },
          },
        ],
      },
      select: {
        id: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        realizedPnL: true,
        positions: {
          where: {
            claimedAt: null, // Only unclaimed positions
            OR: [{ shares0: { gt: 0 } }, { shares1: { gt: 0 } }],
          },
          select: {
            shares0: true,
            shares1: true,
            avgCost0: true,
            avgCost1: true,
            market: {
              select: {
                status: true,
                reserve0: true,
                reserve1: true,
                resolvedOutcome: true,
                feeBps: true,
              },
            },
          },
        },
      },
    });

    // Calculate total PnL (realized + unrealized) for each user
    const usersWithTotalPnL = usersWithActivity.map((user) => {
      const realizedPnL = Number(user.realizedPnL);
      const unrealizedPnL = user.positions.reduce(
        (sum, pos) => sum + calculatePositionUnrealizedPnL(pos),
        0
      );
      const totalPnL = realizedPnL + unrealizedPnL;

      return {
        userId: user.id,
        handle: user.handle,
        name: user.name,
        profileImageUrl: user.profileImageUrl,
        value: Math.round(totalPnL),
      };
    });

    // Filter out zero PnL users and sort
    const filteredUsers = usersWithTotalPnL.filter((u) => u.value !== 0);
    filteredUsers.sort((a, b) => b.value - a.value);

    const total = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice(skip, skip + pageSize);

    const entries = paginatedUsers.map((user, index) => ({
      rank: skip + index + 1,
      userId: user.userId,
      handle: user.handle,
      name: user.name,
      profileImageUrl: user.profileImageUrl,
      value: user.value,
    }));

    return { entries, total };
  }

  // Weekly/Monthly: Calculate PnL from settled bets only
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
  const sortedEntries = Array.from(pnlByUser.entries()).sort(
    (a, b) => b[1] - a[1]
  );

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
    // Get user's total PnL (realized + unrealized)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        realizedPnL: true,
        positions: {
          where: {
            claimedAt: null, // Only unclaimed positions
            OR: [{ shares0: { gt: 0 } }, { shares1: { gt: 0 } }],
          },
          select: {
            shares0: true,
            shares1: true,
            avgCost0: true,
            avgCost1: true,
            market: {
              select: {
                status: true,
                reserve0: true,
                reserve1: true,
                resolvedOutcome: true,
                feeBps: true,
              },
            },
          },
        },
      },
    });

    if (!user) return null;

    const realizedPnL = Number(user.realizedPnL);
    const unrealizedPnL = user.positions.reduce(
      (sum, pos) => sum + calculatePositionUnrealizedPnL(pos),
      0
    );
    const userValue = Math.round(realizedPnL + unrealizedPnL);

    if (userValue === 0) return null;

    // Get all users with PnL to calculate rank
    const allUsersWithPnL = await prisma.user.findMany({
      where: {
        OR: [
          { realizedPnL: { not: 0 } },
          {
            positions: {
              some: {
                claimedAt: null,
                OR: [{ shares0: { gt: 0 } }, { shares1: { gt: 0 } }],
              },
            },
          },
        ],
      },
      select: {
        id: true,
        realizedPnL: true,
        positions: {
          where: {
            claimedAt: null, // Only unclaimed positions
            OR: [{ shares0: { gt: 0 } }, { shares1: { gt: 0 } }],
          },
          select: {
            shares0: true,
            shares1: true,
            avgCost0: true,
            avgCost1: true,
            market: {
              select: {
                status: true,
                reserve0: true,
                reserve1: true,
                resolvedOutcome: true,
                feeBps: true,
              },
            },
          },
        },
      },
    });

    // Calculate total PnL for each user and count how many are ahead
    let usersAhead = 0;
    let totalWithPnL = 0;

    for (const u of allUsersWithPnL) {
      const uRealized = Number(u.realizedPnL);
      const uUnrealized = u.positions.reduce(
        (sum, pos) => sum + calculatePositionUnrealizedPnL(pos),
        0
      );
      const uTotal = Math.round(uRealized + uUnrealized);

      if (uTotal !== 0) {
        totalWithPnL++;
        if (uTotal > userValue) {
          usersAhead++;
        }
      }
    }

    return {
      rank: usersAhead + 1,
      value: userValue,
      totalUsers: totalWithPnL,
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
  let result: { entries: LeaderboardEntry[]; total: number };
  
  if (metric === "xp") {
    result = await getXPLeaderboard(period, page, pageSize);
  } else if (metric === "volume") {
    result = await getVolumeLeaderboard(period, page, pageSize);
  } else {
    result = await getPnLLeaderboard(period, page, pageSize);
  }

  return {
    entries: result.entries,
    metric,
    period,
    page,
    pageSize,
    totalUsers: result.total,
    totalPages: Math.ceil(result.total / pageSize),
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
  if (metric === "xp") {
    return getUserXPRank(userId, period);
  }
  if (metric === "volume") {
    return getUserVolumeRank(userId, period);
  }
  return getUserPnLRank(userId, period);
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
