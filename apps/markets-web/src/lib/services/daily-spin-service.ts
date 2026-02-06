import { prisma, BalanceReason } from "@vault/database";
import { adjustBalance } from "./balance-service";

/**
 * Spin Service (every 6 hours)
 * 
 * Handles spin rewards with a weighted probability distribution.
 * Users can spin once every 6 hours (4x per day).
 * Every spin is a guaranteed win! Min $500, Max $20,000.
 * Expected value: $2,000 per spin.
 * 
 * Prize Distribution:
 * - $500:    32%     (most common)
 * - $750:    18%     (common)
 * - $1,000:  14%     (decent)
 * - $1,500:  10%     (good)
 * - $2,000:  8%      (great)
 * - $3,000:  6%      (big)
 * - $5,000:  5%      (huge)
 * - $7,500:  3%      (massive)
 * - $10,000: 2%      (legendary)
 * - $20,000: 2%      (jackpot!)
 */

export interface SpinReward {
  amount: number;
  label: string;
  tier: "small" | "medium" | "large" | "huge" | "jackpot";
  color: string;
}

// Prize tiers with their weights (must sum to 1000 for precision)
const PRIZE_TIERS: { amount: number; weight: number; label: string; tier: SpinReward["tier"]; color: string }[] = [
  { amount: 500,   weight: 320, label: "$500",    tier: "small",   color: "#10B981" },      // green
  { amount: 750,   weight: 180, label: "$750",    tier: "small",   color: "#10B981" },      // green
  { amount: 1000,  weight: 140, label: "$1,000",  tier: "small",   color: "#3B82F6" },      // blue
  { amount: 1500,  weight: 100, label: "$1,500",  tier: "medium",  color: "#3B82F6" },      // blue
  { amount: 2000,  weight: 80,  label: "$2,000",  tier: "medium",  color: "#8B5CF6" },      // purple
  { amount: 3000,  weight: 60,  label: "$3,000",  tier: "large",   color: "#8B5CF6" },      // purple
  { amount: 5000,  weight: 50,  label: "$5,000",  tier: "large",   color: "#F59E0B" },      // amber
  { amount: 7500,  weight: 30,  label: "$7,500",  tier: "huge",    color: "#F59E0B" },      // amber
  { amount: 10000, weight: 20,  label: "$10,000", tier: "huge",    color: "#FB2C36" },      // red (brand)
  { amount: 20000, weight: 20,  label: "$20,000", tier: "jackpot", color: "#FB2C36" },      // red (brand)
];

// Total weight for verification
const TOTAL_WEIGHT = PRIZE_TIERS.reduce((sum, tier) => sum + tier.weight, 0);

/**
 * Generate a random spin reward using weighted probability
 */
export function generateSpinReward(): SpinReward {
  const random = Math.floor(Math.random() * TOTAL_WEIGHT);
  
  let cumulative = 0;
  for (const tier of PRIZE_TIERS) {
    cumulative += tier.weight;
    if (random < cumulative) {
      return {
        amount: tier.amount,
        label: tier.label,
        tier: tier.tier,
        color: tier.color,
      };
    }
  }
  
  // Fallback (should never reach here)
  return {
    amount: 500,
    label: "$500",
    tier: "small",
    color: "#10B981",
  };
}

/**
 * Get all prize tiers for display on the wheel
 */
export function getPrizeTiers() {
  return PRIZE_TIERS.map(tier => ({
    amount: tier.amount,
    label: tier.label,
    tier: tier.tier,
    color: tier.color,
    probability: (tier.weight / TOTAL_WEIGHT * 100).toFixed(1) + "%",
  }));
}

export interface DailySpinResult {
  success: boolean;
  reward?: SpinReward;
  newBalance?: number;
  error?: string;
  canSpinAt?: Date;
}

/** Spin cooldown in milliseconds (6 hours) */
const SPIN_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/**
 * Get today's date at midnight UTC (for date-bucket in DB)
 */
function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Get the current 6-hour epoch index (0-3) within the day.
 * Epoch 0 = 00:00–05:59, Epoch 1 = 06:00–11:59, etc.
 */
function getCurrentEpoch(): number {
  const now = new Date();
  return Math.floor(now.getUTCHours() / 6);
}

/**
 * Get the start time of the next 6-hour epoch.
 */
function getNextEpochStart(): Date {
  const now = new Date();
  const currentEpoch = getCurrentEpoch();
  const nextEpoch = currentEpoch + 1;
  
  if (nextEpoch >= 4) {
    // Next epoch is epoch 0 of the next day
    const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    return tomorrow;
  }
  
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), nextEpoch * 6));
}

/**
 * Check if user can spin (every 6 hours)
 */
export async function canUserSpin(userId: string): Promise<{ canSpin: boolean; nextSpinAt?: Date; lastReward?: number }> {
  const today = getTodayUTC();
  const epoch = getCurrentEpoch();
  
  const existingSpin = await prisma.dailySpin.findUnique({
    where: {
      userId_spinDate_spinEpoch: {
        userId,
        spinDate: today,
        spinEpoch: epoch,
      },
    },
  });
  
  if (existingSpin) {
    // User already spun this epoch - next spin at start of next epoch
    return {
      canSpin: false,
      nextSpinAt: getNextEpochStart(),
      lastReward: Number(existingSpin.reward),
    };
  }
  
  return { canSpin: true };
}

/**
 * Execute a spin for a user
 * Uses database unique constraint to prevent double spins even under race conditions
 */
export async function executeDailySpin(userId: string): Promise<DailySpinResult> {
  const today = getTodayUTC();
  const epoch = getCurrentEpoch();
  
  // Generate the reward upfront
  const reward = generateSpinReward();
  
  try {
    // Use a transaction with the spin creation to ensure atomicity
    // The unique constraint on (userId, spinDate, spinEpoch) prevents double spins
    const result = await prisma.$transaction(async (tx) => {
      // Try to create the spin record - will fail if already exists due to unique constraint
      await tx.dailySpin.create({
        data: {
          userId,
          spinDate: today,
          spinEpoch: epoch,
          reward: reward.amount,
        },
      });
      
      // Credit their balance (all rewards are now > 0)
      const balanceResult = await adjustBalance(tx, {
        userId,
        delta: reward.amount,
        reason: BalanceReason.DAILY_SPIN,
      });
      
      return { newBalance: balanceResult.balanceAfter };
    });
    
    return {
      success: true,
      reward,
      newBalance: result.newBalance,
    };
  } catch (error: unknown) {
    // Check if this is a unique constraint violation (user already spun this epoch)
    if (
      error instanceof Error && 
      'code' in error && 
      (error as { code: string }).code === 'P2002'
    ) {
      return {
        success: false,
        error: "You've already spun this period! Come back in a few hours.",
        canSpinAt: getNextEpochStart(),
      };
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get user's spin history
 */
export async function getUserSpinHistory(userId: string, limit = 10) {
  return prisma.dailySpin.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      spinDate: true,
      reward: true,
      createdAt: true,
    },
  });
}

/**
 * Admin: Get all spins with pagination and filters
 */
export async function getAdminSpins(options: {
  page?: number;
  pageSize?: number;
  userId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: 'createdAt' | 'reward';
  sortDir?: 'asc' | 'desc';
}) {
  const {
    page = 1,
    pageSize = 50,
    userId,
    dateFrom,
    dateTo,
    sortBy = 'createdAt',
    sortDir = 'desc',
  } = options;

  const where: Record<string, unknown> = {};
  
  if (userId) {
    where.userId = userId;
  }
  
  if (dateFrom || dateTo) {
    where.createdAt = {};
    if (dateFrom) (where.createdAt as Record<string, unknown>).gte = dateFrom;
    if (dateTo) (where.createdAt as Record<string, unknown>).lte = dateTo;
  }

  const [spins, total] = await Promise.all([
    prisma.dailySpin.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
      },
    }),
    prisma.dailySpin.count({ where }),
  ]);

  return {
    spins: spins.map(spin => ({
      ...spin,
      reward: Number(spin.reward),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Admin: Get daily spin statistics
 */
export async function getSpinStats() {
  const today = getTodayUTC();
  const weekAgo = new Date(today);
  weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
  
  const [
    totalSpins,
    totalRewardsResult,
    todaySpins,
    todayRewardsResult,
    weekSpins,
    weekRewardsResult,
    uniqueSpinnersToday,
    rewardDistribution,
  ] = await Promise.all([
    // Total spins all time
    prisma.dailySpin.count(),
    
    // Total rewards all time
    prisma.dailySpin.aggregate({
      _sum: { reward: true },
    }),
    
    // Today's spins
    prisma.dailySpin.count({
      where: { spinDate: today },
    }),
    
    // Today's rewards
    prisma.dailySpin.aggregate({
      where: { spinDate: today },
      _sum: { reward: true },
    }),
    
    // This week's spins
    prisma.dailySpin.count({
      where: { createdAt: { gte: weekAgo } },
    }),
    
    // This week's rewards
    prisma.dailySpin.aggregate({
      where: { createdAt: { gte: weekAgo } },
      _sum: { reward: true },
    }),
    
    // Unique spinners today
    prisma.dailySpin.groupBy({
      by: ['userId'],
      where: { spinDate: today },
    }),
    
    // Reward distribution (group by reward amount)
    prisma.dailySpin.groupBy({
      by: ['reward'],
      _count: { reward: true },
      orderBy: { reward: 'asc' },
    }),
  ]);

  return {
    totalSpins,
    totalRewards: Number(totalRewardsResult._sum.reward ?? 0),
    todaySpins,
    todayRewards: Number(todayRewardsResult._sum.reward ?? 0),
    weekSpins,
    weekRewards: Number(weekRewardsResult._sum.reward ?? 0),
    uniqueSpinnersToday: uniqueSpinnersToday.length,
    rewardDistribution: rewardDistribution.map(r => ({
      amount: Number(r.reward),
      count: r._count.reward,
    })),
    expectedValue: 2000, // Our configured EV
  };
}

