/**
 * XP Service
 *
 * Handles XP (experience points) calculations and management:
 * - XP rate configuration (with in-memory caching)
 * - Awarding XP for trading volume (atomic operations)
 * - Admin XP adjustments
 * - Level calculations (pure functions)
 *
 * Best practices implemented:
 * - In-memory caching for config to reduce DB reads
 * - Atomic database operations to prevent race conditions
 * - Idempotent XP awarding with correlation IDs
 * - Type-safe interfaces
 * - Comprehensive error handling
 */

import { prisma, XPReason } from "@vault/database";

// ============================================================================
// TYPES
// ============================================================================

export interface LevelInfo {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpInCurrentLevel: number;
  xpNeededForNext: number;
  progress: number; // 0-1
}

export interface XPAwardResult {
  xpAwarded: number;
  newXp: number;
  newLevel: number;
  leveledUp: boolean;
}

// ============================================================================
// LEVEL CALCULATIONS (Pure functions - no DB access)
// ============================================================================

/**
 * XP required for a given level: level^2 * 1000
 * Level 1: 1,000 XP
 * Level 2: 4,000 XP
 * Level 3: 9,000 XP
 * Level 10: 100,000 XP
 */
export function xpForLevel(level: number): number {
  return level * level * 1000;
}

/**
 * Calculate level from total XP: floor(sqrt(xp / 1000))
 */
export function calculateLevel(xp: number): number {
  if (xp <= 0) return 0;
  return Math.floor(Math.sqrt(xp / 1000));
}

/**
 * Get detailed level information for display
 */
export function getLevelInfo(xp: number): LevelInfo {
  const level = calculateLevel(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progress = xpNeededForNext > 0 ? xpInCurrentLevel / xpNeededForNext : 0;

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpInCurrentLevel,
    xpNeededForNext,
    progress: Math.min(Math.max(progress, 0), 1), // Clamp between 0 and 1
  };
}

// ============================================================================
// CONFIGURATION (with in-memory caching)
// ============================================================================

const DEFAULT_XP_PER_DOLLAR = 10;
const CONFIG_CACHE_TTL_MS = 60 * 1000; // 1 minute cache

interface CachedConfig {
  value: number;
  expiresAt: number;
}

// Simple in-memory cache for XP rate
let xpRateCache: CachedConfig | null = null;

/**
 * Get the current XP rate per dollar of volume
 * Uses in-memory caching to reduce database reads
 */
export async function getXPRate(): Promise<number> {
  const now = Date.now();

  // Return cached value if valid
  if (xpRateCache && xpRateCache.expiresAt > now) {
    return xpRateCache.value;
  }

  try {
    const config = await prisma.xPConfig.findUnique({
      where: { key: "xp_per_dollar_volume" },
    });

    const rate = config ? parseInt(config.value, 10) : DEFAULT_XP_PER_DOLLAR;
    const validRate = isNaN(rate) ? DEFAULT_XP_PER_DOLLAR : rate;

    // Update cache
    xpRateCache = {
      value: validRate,
      expiresAt: now + CONFIG_CACHE_TTL_MS,
    };

    return validRate;
  } catch (error) {
    console.error("Failed to fetch XP rate, using default:", error);
    return DEFAULT_XP_PER_DOLLAR;
  }
}

/**
 * Invalidate the XP rate cache (call after updates)
 */
export function invalidateXPRateCache(): void {
  xpRateCache = null;
}

/**
 * Update the XP rate per dollar of volume
 */
export async function setXPRate(
  rate: number,
  adminUserId?: string
): Promise<void> {
  await prisma.xPConfig.upsert({
    where: { key: "xp_per_dollar_volume" },
    update: {
      value: String(rate),
      updatedBy: adminUserId,
    },
    create: {
      key: "xp_per_dollar_volume",
      value: String(rate),
      description: "XP awarded per $1 of trading volume",
      updatedBy: adminUserId,
    },
  });

  // Invalidate cache after update
  invalidateXPRateCache();
}

/**
 * Get all XP configuration settings
 */
export async function getAllXPConfig(): Promise<
  { key: string; value: string; description: string | null; updatedAt: Date }[]
> {
  return prisma.xPConfig.findMany({
    select: {
      key: true,
      value: true,
      description: true,
      updatedAt: true,
    },
  });
}

// ============================================================================
// XP AWARDING (with atomic operations and idempotency)
// ============================================================================

/**
 * Award XP for trading volume
 * Uses atomic increment to prevent race conditions
 * Idempotent when correlationId is provided
 */
export async function awardXPForVolume(
  userId: string,
  volumeDelta: number,
  correlationId?: string
): Promise<XPAwardResult | null> {
  // Only award for positive volume
  const absVolume = Math.abs(volumeDelta);
  if (absVolume <= 0) {
    return null;
  }

  // Check for duplicate award if correlationId provided (idempotency)
  if (correlationId) {
    const existing = await prisma.xPLedger.findFirst({
      where: {
        userId,
        correlationId,
        reason: XPReason.TRADE_VOLUME,
      },
    });

    if (existing) {
      // Already awarded for this trade, return the existing result
      return {
        xpAwarded: existing.delta,
        newXp: existing.xpAfter,
        newLevel: calculateLevel(existing.xpAfter),
        leveledUp: false, // Can't determine retroactively
      };
    }
  }

  const xpRate = await getXPRate();
  const xpToAward = Math.floor(absVolume * xpRate);

  if (xpToAward <= 0) {
    return null;
  }

  // Use interactive transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Atomic increment and get updated user in one operation
    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: { xp: { increment: xpToAward } },
      select: { xp: true },
    });

    const xpAfter = updatedUser.xp;
    const xpBefore = xpAfter - xpToAward;

    // Create ledger entry
    await tx.xPLedger.create({
      data: {
        userId,
        delta: xpToAward,
        xpBefore,
        xpAfter,
        reason: XPReason.TRADE_VOLUME,
        correlationId,
      },
    });

    return { xpBefore, xpAfter };
  });

  const levelBefore = calculateLevel(result.xpBefore);
  const levelAfter = calculateLevel(result.xpAfter);

  return {
    xpAwarded: xpToAward,
    newXp: result.xpAfter,
    newLevel: levelAfter,
    leveledUp: levelAfter > levelBefore,
  };
}

// ============================================================================
// ADMIN ADJUSTMENTS
// ============================================================================

/**
 * Adjust a user's XP (admin only)
 * Uses atomic operations for consistency
 */
export async function adjustXP(
  userId: string,
  delta: number,
  reason: XPReason,
  adminUserId: string,
  correlationId?: string
): Promise<{ xpBefore: number; xpAfter: number }> {
  // Use interactive transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Get current XP
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { xp: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    const xpBefore = user.xp;
    // Calculate new XP, preventing negative values
    const xpAfter = Math.max(0, xpBefore + delta);
    const actualDelta = xpAfter - xpBefore;

    // Update user XP
    await tx.user.update({
      where: { id: userId },
      data: { xp: xpAfter },
    });

    // Create ledger entry
    await tx.xPLedger.create({
      data: {
        userId,
        delta: actualDelta,
        xpBefore,
        xpAfter,
        reason,
        adminUserId,
        correlationId,
      },
    });

    return { xpBefore, xpAfter };
  });

  return result;
}

/**
 * Get XP ledger history for a user
 * Paginated for scalability
 */
export async function getXPHistory(
  userId: string,
  limit: number = 50,
  cursor?: string
): Promise<{
  entries: {
    id: string;
    delta: number;
    xpBefore: number;
    xpAfter: number;
    reason: XPReason;
    correlationId: string | null;
    createdAt: Date;
  }[];
  nextCursor: string | null;
}> {
  const entries = await prisma.xPLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit + 1, // Fetch one extra to determine if there's more
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1, // Skip the cursor item
    }),
    select: {
      id: true,
      delta: true,
      xpBefore: true,
      xpAfter: true,
      reason: true,
      correlationId: true,
      createdAt: true,
    },
  });

  // Check if there are more results
  const hasMore = entries.length > limit;
  const resultEntries = hasMore ? entries.slice(0, limit) : entries;
  const nextCursor = hasMore ? resultEntries[resultEntries.length - 1]?.id : null;

  return {
    entries: resultEntries,
    nextCursor,
  };
}

/**
 * Get user's current XP and level info
 */
export async function getUserXPInfo(
  userId: string
): Promise<{ xp: number } & LevelInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true },
  });

  const xp = user?.xp ?? 0;
  const levelInfo = getLevelInfo(xp);

  return {
    xp,
    ...levelInfo,
  };
}

// ============================================================================
// BATCH OPERATIONS (for admin/migration use)
// ============================================================================

/**
 * Backfill XP for existing users based on their totalVolume
 * Processes in batches for scalability
 * Should only be run once during migration
 */
export async function backfillXPFromVolume(batchSize: number = 100): Promise<{
  usersUpdated: number;
  totalXPAwarded: number;
}> {
  const xpRate = await getXPRate();

  let usersUpdated = 0;
  let totalXPAwarded = 0;
  let cursor: string | undefined;

  while (true) {
    // Fetch batch of users with volume but no XP
    const users = await prisma.user.findMany({
      where: {
        totalVolume: { gt: 0 },
        xp: 0,
      },
      select: {
        id: true,
        totalVolume: true,
      },
      take: batchSize,
      ...(cursor && {
        cursor: { id: cursor },
        skip: 1,
      }),
      orderBy: { id: "asc" },
    });

    if (users.length === 0) break;

    // Process batch
    for (const user of users) {
      const volumeNum = Number(user.totalVolume);
      const xpToAward = Math.floor(volumeNum * xpRate);

      if (xpToAward > 0) {
        await prisma.$transaction([
          prisma.user.update({
            where: { id: user.id },
            data: { xp: xpToAward },
          }),
          prisma.xPLedger.create({
            data: {
              userId: user.id,
              delta: xpToAward,
              xpBefore: 0,
              xpAfter: xpToAward,
              reason: XPReason.BONUS,
              correlationId: "backfill",
            },
          }),
        ]);

        usersUpdated++;
        totalXPAwarded += xpToAward;
      }
    }

    cursor = users[users.length - 1]?.id;

    // Small delay to prevent overwhelming the database
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { usersUpdated, totalXPAwarded };
}

/**
 * Get leaderboard of top users by XP
 * Optimized query with limit
 */
export async function getXPLeaderboard(limit: number = 100): Promise<
  {
    userId: string;
    handle: string | null;
    name: string | null;
    xp: number;
    level: number;
  }[]
> {
  const users = await prisma.user.findMany({
    where: { xp: { gt: 0 } },
    orderBy: { xp: "desc" },
    take: limit,
    select: {
      id: true,
      handle: true,
      name: true,
      xp: true,
    },
  });

  return users.map((user) => ({
    userId: user.id,
    handle: user.handle,
    name: user.name,
    xp: user.xp,
    level: calculateLevel(user.xp),
  }));
}

/**
 * Get aggregate XP statistics for admin dashboard
 */
export async function getXPStats(): Promise<{
  totalXPAwarded: number;
  usersWithXP: number;
  averageXP: number;
  medianLevel: number;
}> {
  const [aggregate, count] = await Promise.all([
    prisma.user.aggregate({
      where: { xp: { gt: 0 } },
      _sum: { xp: true },
      _avg: { xp: true },
    }),
    prisma.user.count({
      where: { xp: { gt: 0 } },
    }),
  ]);

  return {
    totalXPAwarded: aggregate._sum.xp ?? 0,
    usersWithXP: count,
    averageXP: Math.round(aggregate._avg.xp ?? 0),
    medianLevel: calculateLevel(aggregate._avg.xp ?? 0),
  };
}
