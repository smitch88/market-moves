/**
 * XP Service
 *
 * Handles XP (experience points) calculations and management:
 * - XP rate configuration (with in-memory caching)
 * - Awarding XP for trading volume (atomic operations)
 * - Anti-abuse protections: daily caps, market cooldowns, diminishing returns
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

import { prisma, XPReason, Prisma } from "@vault/database";
import { getStreakMultiplier } from "./streak-service";

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
  /** Reason if XP was reduced or blocked */
  reason?: string;
  /** Volume traded in this market today (after this trade) */
  marketVolume?: number;
  /** Streak multiplier applied */
  streakMultiplier?: number;
  /** Base XP before streak multiplier */
  baseXp?: number;
}

export interface XPProtectionConfig {
  xpPerDollar: number;
  dailyXpCap: number;
  marketCooldownSeconds: number;
  /** Volume threshold per market per day before diminishing returns kick in (in dollars) */
  marketVolumeThreshold: number;
  /** Percentage of bet amount awarded as XP bonus for sharing (0-100) */
  shareBonusPercent: number;
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

// Default configuration values
const DEFAULT_CONFIG: XPProtectionConfig = {
  xpPerDollar: 10,
  dailyXpCap: 50000, // 50k XP cap (equivalent to $5k volume at 100%)
  marketCooldownSeconds: 60, // 1 minute
  marketVolumeThreshold: 10000, // $10k per tier before diminishing returns (fake money system)
  shareBonusPercent: 20, // 20% of bet amount as XP bonus for sharing
};

const CONFIG_CACHE_TTL_MS = 60 * 1000; // 1 minute cache

interface CachedConfig {
  config: XPProtectionConfig;
  expiresAt: number;
}

// Simple in-memory cache for XP config
let configCache: CachedConfig | null = null;

/**
 * Get all XP protection configuration values
 * Uses in-memory caching to reduce database reads
 */
export async function getXPConfig(): Promise<XPProtectionConfig> {
  const now = Date.now();

  // Return cached value if valid
  if (configCache && configCache.expiresAt > now) {
    return configCache.config;
  }

  try {
    const configs = await prisma.xPConfig.findMany({
      where: {
        key: {
          in: [
            "xp_per_dollar_volume",
            "daily_xp_cap",
            "market_cooldown_seconds",
            "market_volume_threshold",
            "share_bonus_percent",
          ],
        },
      },
    });

    const configMap = new Map(configs.map((c) => [c.key, c.value]));

    const config: XPProtectionConfig = {
      xpPerDollar: parseInt(configMap.get("xp_per_dollar_volume") || "", 10) || DEFAULT_CONFIG.xpPerDollar,
      dailyXpCap: parseInt(configMap.get("daily_xp_cap") || "", 10) || DEFAULT_CONFIG.dailyXpCap,
      marketCooldownSeconds:
        parseInt(configMap.get("market_cooldown_seconds") || "", 10) || DEFAULT_CONFIG.marketCooldownSeconds,
      marketVolumeThreshold:
        parseInt(configMap.get("market_volume_threshold") || "", 10) || DEFAULT_CONFIG.marketVolumeThreshold,
      shareBonusPercent:
        parseInt(configMap.get("share_bonus_percent") || "", 10) || DEFAULT_CONFIG.shareBonusPercent,
    };

    // Update cache
    configCache = {
      config,
      expiresAt: now + CONFIG_CACHE_TTL_MS,
    };

    return config;
  } catch (error) {
    console.error("Failed to fetch XP config, using defaults:", error);
    return DEFAULT_CONFIG;
  }
}

/**
 * Get the current XP rate per dollar of volume
 * Uses in-memory caching to reduce database reads
 */
export async function getXPRate(): Promise<number> {
  const config = await getXPConfig();
  return config.xpPerDollar;
}

/**
 * Invalidate the XP config cache (call after updates)
 */
export function invalidateXPConfigCache(): void {
  configCache = null;
}

// Legacy alias
export const invalidateXPRateCache = invalidateXPConfigCache;

/**
 * Update an XP configuration value
 */
export async function setXPConfigValue(
  key: string,
  value: number,
  description: string,
  adminUserId?: string
): Promise<void> {
  await prisma.xPConfig.upsert({
    where: { key },
    update: {
      value: String(value),
      description,
      updatedBy: adminUserId,
    },
    create: {
      key,
      value: String(value),
      description,
      updatedBy: adminUserId,
    },
  });

  // Invalidate cache after update
  invalidateXPConfigCache();
}

/**
 * Update the XP rate per dollar of volume
 */
export async function setXPRate(rate: number, adminUserId?: string): Promise<void> {
  await setXPConfigValue("xp_per_dollar_volume", rate, "XP awarded per $1 of trading volume", adminUserId);
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
// PROTECTION CHECKS
// ============================================================================

/**
 * Get today's date as a Date object at midnight UTC
 */
function getTodayDate(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Check if user is on cooldown for a market
 * Returns seconds remaining if on cooldown, 0 if not
 */
export async function checkMarketCooldown(
  userId: string,
  marketId: string,
  cooldownSeconds: number
): Promise<number> {
  const today = getTodayDate();

  const tracker = await prisma.xPTradeTracker.findUnique({
    where: {
      userId_marketId_date: {
        userId,
        marketId,
        date: today,
      },
    },
    select: {
      lastTradeAt: true,
    },
  });

  if (!tracker) return 0;

  const secondsSinceLastTrade = Math.floor((Date.now() - tracker.lastTradeAt.getTime()) / 1000);
  const remainingCooldown = cooldownSeconds - secondsSinceLastTrade;

  return remainingCooldown > 0 ? remainingCooldown : 0;
}

/**
 * Get current trade count for user in a specific market today
 */
export async function getMarketTradeCount(userId: string, marketId: string): Promise<number> {
  const today = getTodayDate();

  const tracker = await prisma.xPTradeTracker.findUnique({
    where: {
      userId_marketId_date: {
        userId,
        marketId,
        date: today,
      },
    },
    select: {
      tradeCount: true,
    },
  });

  return tracker?.tradeCount ?? 0;
}

/**
 * Get current volume for user in a specific market today
 */
export async function getMarketVolume(userId: string, marketId: string): Promise<number> {
  const today = getTodayDate();

  const tracker = await prisma.xPTradeTracker.findUnique({
    where: {
      userId_marketId_date: {
        userId,
        marketId,
        date: today,
      },
    },
    select: {
      totalVolume: true,
    },
  });

  return tracker ? Number(tracker.totalVolume) : 0;
}

/**
 * Get user's daily XP total
 */
export async function getDailyXPTotal(userId: string): Promise<number> {
  const today = getTodayDate();

  const daily = await prisma.xPDailyTotal.findUnique({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    select: {
      totalXpEarned: true,
    },
  });

  return daily?.totalXpEarned ?? 0;
}

/**
 * Calculate XP multiplier based on cumulative volume in a market (diminishing returns)
 * This is fairer than trade count - someone betting $100 once gets the same XP
 * as someone betting $20 five times.
 * 
 * Tier 0 ($0 - threshold): 100% XP
 * Tier 1 (threshold - 2x): 80% XP
 * Tier 2 (2x - 3x): 60% XP
 * Tier 3 (3x - 4x): 40% XP
 * Tier 4 (4x - 5x): 20% XP
 * Tier 5+ (5x+): 0% XP
 * 
 * @param currentVolume - Volume already traded in this market today (before this trade)
 * @param tradeAmount - The current trade amount
 * @param threshold - Volume per tier (e.g., $100)
 * @returns Weighted average multiplier for this trade
 */
function getVolumeBasedXPMultiplier(
  currentVolume: number,
  tradeAmount: number,
  threshold: number
): number {
  const multipliers = [1.0, 0.8, 0.6, 0.4, 0.2, 0]; // Tier multipliers
  const maxTiers = multipliers.length - 1; // 5 tiers before 0%
  
  // Calculate how much of the trade falls into each tier
  let remainingAmount = tradeAmount;
  let totalXP = 0;
  let volumeProcessed = currentVolume;
  
  while (remainingAmount > 0) {
    const currentTier = Math.floor(volumeProcessed / threshold);
    
    if (currentTier >= maxTiers) {
      // All remaining volume gets 0% XP
      break;
    }
    
    const tierCeiling = (currentTier + 1) * threshold;
    const amountInThisTier = Math.min(remainingAmount, tierCeiling - volumeProcessed);
    const tierMultiplier = multipliers[currentTier] ?? 0;
    
    totalXP += amountInThisTier * tierMultiplier;
    remainingAmount -= amountInThisTier;
    volumeProcessed += amountInThisTier;
  }
  
  // Return the effective multiplier (weighted average)
  return tradeAmount > 0 ? totalXP / tradeAmount : 0;
}

/**
 * Get the current tier info for display purposes
 */
function getVolumeTierInfo(
  currentVolume: number,
  threshold: number
): { tier: number; multiplier: number; volumeUntilNextTier: number } {
  const multipliers = [1.0, 0.8, 0.6, 0.4, 0.2, 0];
  const tier = Math.min(Math.floor(currentVolume / threshold), multipliers.length - 1);
  const multiplier = multipliers[tier] ?? 0;
  const volumeUntilNextTier = tier < multipliers.length - 1 
    ? (tier + 1) * threshold - currentVolume 
    : 0;
  
  return { tier, multiplier, volumeUntilNextTier };
}

// ============================================================================
// XP AWARDING (with atomic operations, idempotency, and protections)
// ============================================================================

export interface AwardXPOptions {
  userId: string;
  marketId: string;
  volumeDelta: number;
  correlationId?: string;
  /** Skip protections (for admin adjustments) */
  skipProtections?: boolean;
}

/**
 * Award XP for trading volume with full protection checks
 * - Daily cap enforcement
 * - Per-market cooldown
 * - Diminishing returns per market
 * 
 * Uses atomic increment to prevent race conditions
 * Idempotent when correlationId is provided
 */
export async function awardXPForVolume(
  userId: string,
  volumeDelta: number,
  correlationId?: string,
  marketId?: string
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
        leveledUp: false,
        reason: "Already awarded (idempotent)",
      };
    }
  }

  // Get configuration
  const config = await getXPConfig();
  const rawBaseXP = Math.floor(absVolume * config.xpPerDollar);

  if (rawBaseXP <= 0) {
    return null;
  }

  // Fetch user's streak for multiplier
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { currentStreak: true, lastActiveDate: true },
  });

  // Check if streak is still valid (active today or yesterday)
  const today = getTodayDate();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  let effectiveStreak = user?.currentStreak ?? 0;
  
  if (user?.lastActiveDate) {
    const lastActiveDay = new Date(Date.UTC(
      user.lastActiveDate.getUTCFullYear(),
      user.lastActiveDate.getUTCMonth(),
      user.lastActiveDate.getUTCDate()
    ));
    
    // If last active was before yesterday, streak is broken
    if (lastActiveDay < yesterday) {
      effectiveStreak = 0;
    }
  } else {
    effectiveStreak = 0;
  }

  // Apply streak multiplier to base XP
  const streakMultiplier = getStreakMultiplier(effectiveStreak);
  const baseXP = Math.floor(rawBaseXP * streakMultiplier);

  let xpToAward = baseXP;
  let reason: string | undefined;
  let currentMarketVolume = 0;
  
  // Add streak info to reason if multiplier > 1
  if (streakMultiplier > 1) {
    reason = `${streakMultiplier}x streak bonus applied`;
  }

  // If marketId provided, apply protection checks
  if (marketId) {
    // 1. Check daily cap
    const currentDailyXP = await getDailyXPTotal(userId);
    if (currentDailyXP >= config.dailyXpCap) {
      return {
        xpAwarded: 0,
        newXp: 0, // Will be set below
        newLevel: 0,
        leveledUp: false,
        reason: `Daily XP cap reached (${config.dailyXpCap.toLocaleString()} XP)`,
        marketVolume: 0,
      };
    }

    // 2. Check cooldown
    const cooldownRemaining = await checkMarketCooldown(userId, marketId, config.marketCooldownSeconds);
    if (cooldownRemaining > 0) {
      return {
        xpAwarded: 0,
        newXp: 0,
        newLevel: 0,
        leveledUp: false,
        reason: `Market cooldown active (${cooldownRemaining}s remaining)`,
        marketVolume: 0,
      };
    }

    // 3. Get market volume and apply volume-based diminishing returns
    currentMarketVolume = await getMarketVolume(userId, marketId);
    const multiplier = getVolumeBasedXPMultiplier(currentMarketVolume, absVolume, config.marketVolumeThreshold);
    const tierInfo = getVolumeTierInfo(currentMarketVolume, config.marketVolumeThreshold);

    if (multiplier === 0) {
      reason = `Volume cap reached for this market today ($${(config.marketVolumeThreshold * 5).toLocaleString()})`;
      xpToAward = 0;
    } else if (multiplier < 1) {
      xpToAward = Math.floor(baseXP * multiplier);
      reason = `Diminishing returns: ~${Math.round(multiplier * 100)}% (tier ${tierInfo.tier + 1}, $${Math.round(currentMarketVolume)} traded)`;
    }

    // 4. Cap XP to not exceed daily limit
    const remainingDailyCap = config.dailyXpCap - currentDailyXP;
    if (xpToAward > remainingDailyCap) {
      xpToAward = remainingDailyCap;
      reason = `Capped to daily limit (${config.dailyXpCap.toLocaleString()} XP)`;
    }
  }

  // If no XP to award after protections, return early
  if (xpToAward <= 0) {
    // Still need to get user's current XP for the response
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { xp: true },
    });
    return {
      xpAwarded: 0,
      newXp: currentUser?.xp ?? 0,
      newLevel: calculateLevel(currentUser?.xp ?? 0),
      leveledUp: false,
      reason,
      marketVolume: currentMarketVolume + absVolume,
      streakMultiplier,
      baseXp: rawBaseXP,
    };
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

    // Update tracking tables if marketId provided
    if (marketId) {
      // Update per-market tracker
      await tx.xPTradeTracker.upsert({
        where: {
          userId_marketId_date: {
            userId,
            marketId,
            date: today,
          },
        },
        create: {
          userId,
          marketId,
          date: today,
          tradeCount: 1,
          totalVolume: new Prisma.Decimal(absVolume),
          xpEarned: xpToAward,
          lastTradeAt: new Date(),
        },
        update: {
          tradeCount: { increment: 1 },
          totalVolume: { increment: new Prisma.Decimal(absVolume) },
          xpEarned: { increment: xpToAward },
          lastTradeAt: new Date(),
        },
      });

      // Update daily total
      await tx.xPDailyTotal.upsert({
        where: {
          userId_date: {
            userId,
            date: today,
          },
        },
        create: {
          userId,
          date: today,
          totalXpEarned: xpToAward,
          totalVolume: new Prisma.Decimal(absVolume),
          tradesCount: 1,
          marketsTraded: 1,
        },
        update: {
          totalXpEarned: { increment: xpToAward },
          totalVolume: { increment: new Prisma.Decimal(absVolume) },
          tradesCount: { increment: 1 },
          // marketsTraded is harder to update atomically, skip for now
        },
      });
    }

    return { xpBefore, xpAfter };
  });

  const levelBefore = calculateLevel(result.xpBefore);
  const levelAfter = calculateLevel(result.xpAfter);

  return {
    xpAwarded: xpToAward,
    newXp: result.xpAfter,
    newLevel: levelAfter,
    leveledUp: levelAfter > levelBefore,
    reason,
    marketVolume: currentMarketVolume + absVolume,
    streakMultiplier,
    baseXp: rawBaseXP,
  };
}

/**
 * Get user's XP protection status for a specific market
 * Useful for displaying to users before they trade
 */
export async function getXPStatus(
  userId: string,
  marketId: string
): Promise<{
  dailyXpEarned: number;
  dailyXpCap: number;
  dailyXpRemaining: number;
  marketVolume: number;
  marketVolumeThreshold: number;
  marketVolumeCap: number;
  currentTier: number;
  cooldownRemaining: number;
  nextTradeMultiplier: number;
  volumeUntilNextTier: number;
}> {
  const config = await getXPConfig();
  const today = getTodayDate();

  const [dailyTotal, marketTracker] = await Promise.all([
    prisma.xPDailyTotal.findUnique({
      where: { userId_date: { userId, date: today } },
    }),
    prisma.xPTradeTracker.findUnique({
      where: { userId_marketId_date: { userId, marketId, date: today } },
    }),
  ]);

  const dailyXpEarned = dailyTotal?.totalXpEarned ?? 0;
  const marketVolume = marketTracker ? Number(marketTracker.totalVolume) : 0;

  const cooldownRemaining = marketTracker
    ? Math.max(0, config.marketCooldownSeconds - Math.floor((Date.now() - marketTracker.lastTradeAt.getTime()) / 1000))
    : 0;

  const tierInfo = getVolumeTierInfo(marketVolume, config.marketVolumeThreshold);
  // For next trade multiplier, assume a small trade to get current tier's multiplier
  const nextTradeMultiplier = tierInfo.multiplier;

  return {
    dailyXpEarned,
    dailyXpCap: config.dailyXpCap,
    dailyXpRemaining: Math.max(0, config.dailyXpCap - dailyXpEarned),
    marketVolume,
    marketVolumeThreshold: config.marketVolumeThreshold,
    marketVolumeCap: config.marketVolumeThreshold * 5, // 5 tiers before 0%
    currentTier: tierInfo.tier,
    cooldownRemaining,
    nextTradeMultiplier,
    volumeUntilNextTier: tierInfo.volumeUntilNextTier,
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
export async function getUserXPInfo(userId: string): Promise<{ xp: number } & LevelInfo> {
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
  const config = await getXPConfig();

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
      const xpToAward = Math.floor(volumeNum * config.xpPerDollar);

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
export async function getXPLeaderboard(
  limit: number = 100
): Promise<
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

/**
 * Get daily XP statistics for admin dashboard
 */
export async function getDailyXPStats(
  days: number = 7
): Promise<
  {
    date: Date;
    totalXpAwarded: number;
    uniqueUsers: number;
    totalTrades: number;
  }[]
> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setUTCHours(0, 0, 0, 0);

  const dailyTotals = await prisma.xPDailyTotal.groupBy({
    by: ["date"],
    where: {
      date: { gte: startDate },
    },
    _sum: {
      totalXpEarned: true,
      tradesCount: true,
    },
    _count: {
      userId: true,
    },
    orderBy: { date: "asc" },
  });

  return dailyTotals.map((day) => ({
    date: day.date,
    totalXpAwarded: day._sum.totalXpEarned ?? 0,
    uniqueUsers: day._count.userId,
    totalTrades: day._sum.tradesCount ?? 0,
  }));
}
