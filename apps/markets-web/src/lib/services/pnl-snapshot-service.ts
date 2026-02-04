/**
 * PnL Snapshot Service
 * 
 * Manages the materialized view for PnL leaderboard data.
 * Pre-computes total PnL (realized + unrealized) for all users
 * to enable fast leaderboard queries without calculating unrealized PnL on every request.
 * 
 * The snapshot is refreshed via a cron job every 30 minutes.
 */

import { prisma } from "@vault/database";

// ============================================================================
// TYPES
// ============================================================================

export interface PnLSnapshotEntry {
  userId: string;
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  totalVolume: number;
}

export interface SnapshotRefreshResult {
  success: boolean;
  userCount: number;
  durationMs: number;
  refreshedAt: Date;
  error?: string;
}

export interface SnapshotMetadata {
  lastRefresh: Date;
  userCount: number;
  durationMs: number;
  status: string;
  error: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Calculate unrealized PnL for a position
 * Same logic as leaderboard-service.ts calculatePositionUnrealizedPnL
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

// ============================================================================
// CORE FUNCTIONS
// ============================================================================

/**
 * Refresh the PnL snapshot for all users
 * This is called by the cron job to update the materialized view
 * 
 * Uses CONCURRENTLY-style refresh:
 * 1. Compute all snapshots into a batch
 * 2. Delete old snapshots and insert new ones in a transaction
 */
export async function refreshPnLSnapshot(): Promise<SnapshotRefreshResult> {
  const startTime = Date.now();
  const refreshedAt = new Date();

  try {
    // Update metadata to show we're running
    await prisma.leaderboardSnapshotMeta.upsert({
      where: { id: "pnl_snapshot" },
      create: {
        id: "pnl_snapshot",
        status: "running",
        lastRefresh: refreshedAt,
      },
      update: {
        status: "running",
      },
    });

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
        realizedPnL: true,
        totalVolume: true,
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

    // Calculate total PnL for each user
    const snapshotEntries: PnLSnapshotEntry[] = usersWithActivity.map((user) => {
      const realizedPnL = Number(user.realizedPnL);
      const unrealizedPnL = user.positions.reduce(
        (sum, pos) => sum + calculatePositionUnrealizedPnL(pos),
        0
      );
      const totalPnL = realizedPnL + unrealizedPnL;
      const totalVolume = Number(user.totalVolume);

      return {
        userId: user.id,
        realizedPnL: Math.round(realizedPnL * 10000) / 10000, // Keep 4 decimal precision
        unrealizedPnL: Math.round(unrealizedPnL * 10000) / 10000,
        totalPnL: Math.round(totalPnL * 10000) / 10000,
        totalVolume: Math.round(totalVolume * 100) / 100, // Keep 2 decimal precision
      };
    });

    // Filter out users with zero total PnL
    const validEntries = snapshotEntries.filter((e) => e.totalPnL !== 0);

    // Perform atomic refresh: delete all old snapshots and insert new ones
    await prisma.$transaction(async (tx) => {
      // Delete all existing snapshots
      await tx.leaderboardPnLSnapshot.deleteMany({});

      // Insert new snapshots in batches to avoid memory issues
      const BATCH_SIZE = 500;
      for (let i = 0; i < validEntries.length; i += BATCH_SIZE) {
        const batch = validEntries.slice(i, i + BATCH_SIZE);
        await tx.leaderboardPnLSnapshot.createMany({
          data: batch.map((entry) => ({
            userId: entry.userId,
            realizedPnL: entry.realizedPnL,
            unrealizedPnL: entry.unrealizedPnL,
            totalPnL: entry.totalPnL,
            totalVolume: entry.totalVolume,
            refreshedAt,
          })),
        });
      }
    });

    const durationMs = Date.now() - startTime;

    // Update metadata with success
    await prisma.leaderboardSnapshotMeta.upsert({
      where: { id: "pnl_snapshot" },
      create: {
        id: "pnl_snapshot",
        lastRefresh: refreshedAt,
        userCount: validEntries.length,
        durationMs,
        status: "completed",
        error: null,
      },
      update: {
        lastRefresh: refreshedAt,
        userCount: validEntries.length,
        durationMs,
        status: "completed",
        error: null,
      },
    });

    return {
      success: true,
      userCount: validEntries.length,
      durationMs,
      refreshedAt,
    };
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update metadata with failure
    await prisma.leaderboardSnapshotMeta.upsert({
      where: { id: "pnl_snapshot" },
      create: {
        id: "pnl_snapshot",
        lastRefresh: refreshedAt,
        userCount: 0,
        durationMs,
        status: "failed",
        error: errorMessage,
      },
      update: {
        lastRefresh: refreshedAt,
        durationMs,
        status: "failed",
        error: errorMessage,
      },
    });

    return {
      success: false,
      userCount: 0,
      durationMs,
      refreshedAt,
      error: errorMessage,
    };
  }
}

/**
 * Get the snapshot metadata (last refresh time, etc.)
 */
export async function getSnapshotMetadata(): Promise<SnapshotMetadata | null> {
  const meta = await prisma.leaderboardSnapshotMeta.findUnique({
    where: { id: "pnl_snapshot" },
  });

  if (!meta) return null;

  return {
    lastRefresh: meta.lastRefresh,
    userCount: meta.userCount,
    durationMs: meta.durationMs,
    status: meta.status,
    error: meta.error,
  };
}

/**
 * Check if a valid snapshot exists (refreshed within the last 2 hours)
 */
export async function hasValidSnapshot(): Promise<boolean> {
  const meta = await prisma.leaderboardSnapshotMeta.findUnique({
    where: { id: "pnl_snapshot" },
  });

  if (!meta || meta.status !== "completed") return false;

  // Consider snapshot valid if refreshed within the last 2 hours
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  return meta.lastRefresh >= twoHoursAgo;
}

/**
 * Get PnL leaderboard from snapshot with pagination
 * Returns null if no valid snapshot exists (caller should fall back to live calculation)
 */
export async function getPnLLeaderboardFromSnapshot(
  page: number = 1,
  pageSize: number = 25
): Promise<{
  entries: Array<{
    userId: string;
    realizedPnL: number;
    unrealizedPnL: number;
    totalPnL: number;
    totalVolume: number;
  }>;
  total: number;
  lastRefresh: Date;
} | null> {
  // Check if we have a valid snapshot
  const hasValid = await hasValidSnapshot();
  if (!hasValid) return null;

  const skip = (page - 1) * pageSize;

  const [snapshots, total, meta] = await Promise.all([
    prisma.leaderboardPnLSnapshot.findMany({
      orderBy: { totalPnL: "desc" },
      skip,
      take: pageSize,
      select: {
        userId: true,
        realizedPnL: true,
        unrealizedPnL: true,
        totalPnL: true,
        totalVolume: true,
      },
    }),
    prisma.leaderboardPnLSnapshot.count(),
    prisma.leaderboardSnapshotMeta.findUnique({
      where: { id: "pnl_snapshot" },
      select: { lastRefresh: true },
    }),
  ]);

  return {
    entries: snapshots.map((s: { userId: string; realizedPnL: unknown; unrealizedPnL: unknown; totalPnL: unknown; totalVolume: unknown }) => ({
      userId: s.userId,
      realizedPnL: Number(s.realizedPnL),
      unrealizedPnL: Number(s.unrealizedPnL),
      totalPnL: Number(s.totalPnL),
      totalVolume: Number(s.totalVolume),
    })),
    total,
    lastRefresh: meta?.lastRefresh || new Date(),
  };
}

/**
 * Get a specific user's PnL from snapshot
 * Returns null if no valid snapshot or user not found
 */
export async function getUserPnLFromSnapshot(
  userId: string
): Promise<{
  realizedPnL: number;
  unrealizedPnL: number;
  totalPnL: number;
  totalVolume: number;
  rank: number;
  totalUsers: number;
  lastRefresh: Date;
} | null> {
  const hasValid = await hasValidSnapshot();
  if (!hasValid) return null;

  const [userSnapshot, total, usersAhead, meta] = await Promise.all([
    prisma.leaderboardPnLSnapshot.findUnique({
      where: { userId },
      select: {
        realizedPnL: true,
        unrealizedPnL: true,
        totalPnL: true,
        totalVolume: true,
      },
    }),
    prisma.leaderboardPnLSnapshot.count(),
    // Count users with higher PnL
    prisma.leaderboardPnLSnapshot.count({
      where: {
        totalPnL: { gt: 0 }, // Will be updated after we get user's PnL
      },
    }),
    prisma.leaderboardSnapshotMeta.findUnique({
      where: { id: "pnl_snapshot" },
      select: { lastRefresh: true },
    }),
  ]);

  if (!userSnapshot) return null;

  // Get actual rank
  const rank = await prisma.leaderboardPnLSnapshot.count({
    where: {
      totalPnL: { gt: userSnapshot.totalPnL },
    },
  });

  return {
    realizedPnL: Number(userSnapshot.realizedPnL),
    unrealizedPnL: Number(userSnapshot.unrealizedPnL),
    totalPnL: Number(userSnapshot.totalPnL),
    totalVolume: Number(userSnapshot.totalVolume),
    rank: rank + 1,
    totalUsers: total,
    lastRefresh: meta?.lastRefresh || new Date(),
  };
}
