/**
 * Stats Service
 * 
 * Handles user statistics calculations including:
 * - Realized PnL (from settled bets)
 * - Unrealized PnL (from open positions)
 * - Trading volume
 * - Win rate and other metrics
 */

import { prisma, BetStatus } from "@vault/database";
import { awardXPForVolume } from "./xp-service";

// ============================================================================
// TYPES
// ============================================================================

export interface UserStats {
  realizedPnL: number;     // Sum of (payout - amount) for settled bets (cents)
  unrealizedPnL: number;   // Current position value - cost basis (cents)
  totalPnL: number;        // realized + unrealized
  totalVolume: number;     // Sum of |bet amounts| (cents)
  winRate: number;         // Won bets / total settled bets (0-1)
  totalBets: number;
  wonBets: number;
  lostBets: number;
  openPositions: number;
}

export interface PnLHistoryPoint {
  timestamp: Date;
  realizedPnL: number;
  unrealizedPnL: number;
  totalVolume: number;
}

// ============================================================================
// CALCULATIONS
// ============================================================================

/**
 * Calculate realized PnL from settled bets (redemptions only)
 * This is used for recalculation/verification, not for normal stats.
 * Realized PnL = sum of (payout - amount) for WON/LOST bets
 */
export async function calculateRealizedPnL(userId: string): Promise<number> {
  const settledBets = await prisma.bet.findMany({
    where: {
      userId,
      status: { in: [BetStatus.WON, BetStatus.LOST] },
      payout: { not: null },
    },
    select: {
      amount: true,
      payout: true,
      tradeType: true,
    },
  });

  return settledBets.reduce((total, bet) => {
    // For buys: PnL = payout - amount
    // For sells: amount is negative (proceeds), so PnL = 0 (already realized at sell time)
    if (bet.tradeType === "SELL") {
      return total; // Sells are already realized when executed
    }
    const payout = Number(bet.payout ?? 0);
    const amount = Number(bet.amount);
    return total + (payout - amount);
  }, 0);
}

/**
 * Calculate realized PnL from all sell transactions
 * For each sell: PnL = proceeds - (shares × pricePerShare when bought)
 * 
 * Note: This estimates profit based on the original buy price stored in the bet.
 * The sell bet stores pricePerShare which is the sell price.
 * We pair it with corresponding buys to calculate profit.
 */
export async function calculateSellProfits(userId: string): Promise<number> {
  // Get all sell bets with their market and the user's buy bets
  const sellBets = await prisma.bet.findMany({
    where: {
      userId,
      tradeType: "SELL",
      status: BetStatus.CONFIRMED,
    },
    select: {
      marketId: true,
      outcomeIndex: true,
      shares: true, // Negative
      amount: true, // Negative (proceeds)
      pricePerShare: true, // Sell price
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Get all buy bets to calculate weighted average cost
  const buyBets = await prisma.bet.findMany({
    where: {
      userId,
      tradeType: "BUY",
      status: { in: [BetStatus.CONFIRMED, BetStatus.WON, BetStatus.LOST] },
    },
    select: {
      marketId: true,
      outcomeIndex: true,
      shares: true,
      amount: true,
      pricePerShare: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  let totalProfit = 0;

  // For each sell, calculate profit based on FIFO or weighted average
  // Using weighted average for simplicity
  for (const sell of sellBets) {
    // Find all buys for this market/outcome before or at the sell time
    const relevantBuys = buyBets.filter(
      (b) =>
        b.marketId === sell.marketId &&
        b.outcomeIndex === sell.outcomeIndex &&
        new Date(b.createdAt) <= new Date(sell.createdAt)
    );

    if (relevantBuys.length === 0) continue;

    // Calculate weighted average cost
    let totalShares = 0;
    let totalCost = 0;
    for (const buy of relevantBuys) {
      const shares = Number(buy.shares);
      const cost = Number(buy.amount);
      totalShares += shares;
      totalCost += cost;
    }

    const avgCost = totalShares > 0 ? totalCost / totalShares : 0;

    // Calculate profit: proceeds - (shares sold × avgCost)
    const sharesSold = Math.abs(Number(sell.shares));
    const proceeds = Math.abs(Number(sell.amount));
    const costBasis = sharesSold * avgCost;
    const profit = proceeds - costBasis;

    totalProfit += profit;
  }

  return Math.round(totalProfit);
}

/**
 * Recalculate and fix a user's realized PnL
 * This accounts for both redemption profits and sell profits
 */
export async function recalculateUserRealizedPnL(userId: string): Promise<{
  oldPnL: number;
  newPnL: number;
  redemptionPnL: number;
  sellPnL: number;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { realizedPnL: true },
  });

  const oldPnL = user ? Number(user.realizedPnL) : 0;

  // Calculate both components
  const [redemptionPnL, sellPnL] = await Promise.all([
    calculateRealizedPnL(userId), // From settled bets (redemptions)
    calculateSellProfits(userId), // From sells
  ]);

  const newPnL = redemptionPnL + sellPnL;

  // Update the user's realized PnL
  await prisma.user.update({
    where: { id: userId },
    data: { realizedPnL: newPnL },
  });

  return {
    oldPnL,
    newPnL,
    redemptionPnL,
    sellPnL,
  };
}

/**
 * Calculate unrealized PnL from positions
 * 
 * This includes:
 * - OPEN/PUBLISHED markets: value based on current market prices
 * - RESOLVED markets: value based on winning outcome (1 share = $1 for winners, 0 for losers)
 * - SETTLED but unclaimed: same as resolved (known payout not yet claimed)
 * 
 * All of this is "unrealized" until the user either sells or redeems their position.
 */
export async function calculateUnrealizedPnL(userId: string): Promise<number> {
  const positions = await prisma.position.findMany({
    where: {
      userId,
      claimedAt: null, // Only unclaimed positions count as unrealized
      OR: [
        { shares0: { gt: 0 } },
        { shares1: { gt: 0 } },
      ],
    },
    include: {
      market: {
        select: {
          status: true,
          reserve0: true,
          reserve1: true,
          outcomePrices: true,
          resolvedOutcome: true,
          feeBps: true,
        },
      },
    },
  });

  let unrealizedPnL = 0;

  for (const position of positions) {
    const { market } = position;
    const shares0 = Number(position.shares0);
    const shares1 = Number(position.shares1);
    const avgCost0 = Number(position.avgCost0);
    const avgCost1 = Number(position.avgCost1);

    // Skip if no shares
    if (shares0 <= 0 && shares1 <= 0) continue;

    // Handle based on market status
    if (market.status === "RESOLVED" || market.status === "SETTLED") {
      // For resolved/settled markets, we know the outcome
      // Winning shares = $1 each (minus fee), losing shares = $0
      const fee = market.feeBps / 10000;
      const winningOutcome = market.resolvedOutcome;

      if (winningOutcome === 0) {
        // Outcome 0 won
        const currentValue = shares0 * (1 - fee);
        const costBasis = shares0 * avgCost0;
        unrealizedPnL += currentValue - costBasis;
        // Outcome 1 lost - shares are worth 0
        unrealizedPnL -= shares1 * avgCost1; // Lost entire cost basis
      } else if (winningOutcome === 1) {
        // Outcome 1 won
        const currentValue = shares1 * (1 - fee);
        const costBasis = shares1 * avgCost1;
        unrealizedPnL += currentValue - costBasis;
        // Outcome 0 lost - shares are worth 0
        unrealizedPnL -= shares0 * avgCost0; // Lost entire cost basis
      }
    } else if (market.status === "OPEN" || market.status === "PUBLISHED") {
      // For open markets, use current market prices (CPMM)
      const reserve0 = Number(market.reserve0);
      const reserve1 = Number(market.reserve1);
      const totalReserve = reserve0 + reserve1;

      if (totalReserve > 0) {
        const price0 = reserve1 / totalReserve;
        const price1 = reserve0 / totalReserve;

        if (shares0 > 0) {
          const currentValue = shares0 * price0;
          const costBasis = shares0 * avgCost0;
          unrealizedPnL += currentValue - costBasis;
        }

        if (shares1 > 0) {
          const currentValue = shares1 * price1;
          const costBasis = shares1 * avgCost1;
          unrealizedPnL += currentValue - costBasis;
        }
      }
    }
    // Skip CLOSED or other statuses
  }

  return Math.round(unrealizedPnL);
}

/**
 * Calculate unclaimed payouts from settled positions
 * This is money the user has "won" but hasn't claimed yet
 */
export async function calculateUnclaimedPayouts(userId: string): Promise<number> {
  const positions = await prisma.position.findMany({
    where: {
      userId,
      claimedAt: null, // Not yet claimed
      market: {
        settledAt: { not: null }, // Market is settled
      },
    },
    include: {
      market: {
        select: {
          resolvedOutcome: true,
          feeBps: true,
        },
      },
    },
  });

  let unclaimedPayout = 0;

  for (const position of positions) {
    const { market } = position;
    const fee = market.feeBps / 10000;
    const winningOutcome = market.resolvedOutcome;

    if (winningOutcome === 0 && Number(position.shares0) > 0) {
      unclaimedPayout += Number(position.shares0) * (1 - fee);
    } else if (winningOutcome === 1 && Number(position.shares1) > 0) {
      unclaimedPayout += Number(position.shares1) * (1 - fee);
    }
  }

  return Math.round(unclaimedPayout);
}

/**
 * Calculate total trading volume
 * Volume = sum of absolute bet amounts (buys + sells)
 */
export async function calculateVolume(userId: string): Promise<number> {
  const result = await prisma.bet.aggregate({
    where: {
      userId,
      status: { in: [BetStatus.CONFIRMED, BetStatus.WON, BetStatus.LOST] },
    },
    _sum: {
      amount: true,
    },
  });

  // Amount is negative for sells, so we need absolute values
  // Actually, let's get all bets and sum absolute values
  const bets = await prisma.bet.findMany({
    where: {
      userId,
      status: { in: [BetStatus.CONFIRMED, BetStatus.WON, BetStatus.LOST] },
    },
    select: {
      amount: true,
    },
  });

  return bets.reduce((total, bet) => total + Math.abs(Number(bet.amount)), 0);
}

/**
 * Get comprehensive user stats
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  // Get user's stored realized PnL (updated on sells and redemptions)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { realizedPnL: true, totalVolume: true },
  });

  const storedRealizedPnL = user ? Number(user.realizedPnL) : 0;
  const storedTotalVolume = user ? Number(user.totalVolume) : 0;

  // Get other stats in parallel
  const [
    unrealizedPnL,
    betCounts,
    openPositions,
  ] = await Promise.all([
    calculateUnrealizedPnL(userId),
    prisma.bet.groupBy({
      by: ["status"],
      where: {
        userId,
        status: { in: [BetStatus.WON, BetStatus.LOST, BetStatus.CONFIRMED] },
        tradeType: "BUY", // Only count buys for win rate
      },
      _count: true,
    }),
    prisma.position.count({
      where: {
        userId,
        claimedAt: null, // Only count unclaimed positions
        OR: [
          { shares0: { gt: 0 } },
          { shares1: { gt: 0 } },
          { amount0: { gt: 0 } },
          { amount1: { gt: 0 } },
        ],
      },
    }),
  ]);

  // Calculate bet stats
  let wonBets = 0;
  let lostBets = 0;
  let confirmedBets = 0;

  for (const group of betCounts) {
    if (group.status === BetStatus.WON) wonBets = group._count;
    if (group.status === BetStatus.LOST) lostBets = group._count;
    if (group.status === BetStatus.CONFIRMED) confirmedBets = group._count;
  }

  const settledBets = wonBets + lostBets;
  const winRate = settledBets > 0 ? wonBets / settledBets : 0;
  const totalBets = wonBets + lostBets + confirmedBets;

  return {
    realizedPnL: storedRealizedPnL,
    unrealizedPnL,
    totalPnL: storedRealizedPnL + unrealizedPnL,
    totalVolume: storedTotalVolume,
    winRate,
    totalBets,
    wonBets,
    lostBets,
    openPositions,
  };
}

/**
 * Create a PnL snapshot for historical tracking
 * Rate-limited to max once per hour per user
 */
export async function createPnLSnapshot(userId: string): Promise<boolean> {
  // Check for recent snapshot (rate limit: 1 hour)
  const recentSnapshot = await prisma.userPnLSnapshot.findFirst({
    where: {
      userId,
      createdAt: {
        gte: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      },
    },
  });

  if (recentSnapshot) {
    return false; // Rate limited
  }

  // Get current stats
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { realizedPnL: true, totalVolume: true },
  });

  if (!user) {
    return false;
  }

  const unrealizedPnL = await calculateUnrealizedPnL(userId);

  // Create snapshot
  await prisma.userPnLSnapshot.create({
    data: {
      userId,
      realizedPnL: user.realizedPnL,
      unrealizedPnL,
      totalVolume: user.totalVolume,
    },
  });

  return true;
}

/**
 * Get PnL history for charting
 */
export async function getPnLHistory(
  userId: string,
  days: number = 30
): Promise<PnLHistoryPoint[]> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const snapshots = await prisma.userPnLSnapshot.findMany({
    where: {
      userId,
      createdAt: { gte: startDate },
    },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      realizedPnL: true,
      unrealizedPnL: true,
      totalVolume: true,
    },
  });

  return snapshots.map((s) => ({
    timestamp: s.createdAt,
    realizedPnL: Number(s.realizedPnL),
    unrealizedPnL: Number(s.unrealizedPnL),
    totalVolume: Number(s.totalVolume),
  }));
}

interface UpdateUserStatsOptions {
  correlationId?: string;
  marketId?: string;
  /** Skip XP awarding (e.g., for sells to prevent wash trading) */
  skipXP?: boolean;
}

/**
 * Update user's running stats (called after trades/settlements)
 * Also awards XP based on trading volume with protection checks (unless skipXP is true)
 */
export async function updateUserStats(
  userId: string,
  volumeDelta: number,
  realizedPnLDelta: number = 0,
  options: UpdateUserStatsOptions = {}
): Promise<void> {
  const { correlationId, marketId, skipXP = false } = options;
  
  // Update volume and PnL
  await prisma.user.update({
    where: { id: userId },
    data: {
      totalVolume: { increment: Math.abs(volumeDelta) },
      realizedPnL: { increment: realizedPnLDelta },
    },
  });

  // Award XP for volume with protection checks (fire-and-forget, don't block the trade)
  // Skip for sells to prevent wash trading
  if (!skipXP) {
    awardXPForVolume(userId, volumeDelta, correlationId, marketId).catch((err) => {
      console.error(`Failed to award XP for user ${userId}:`, err);
    });
  }
}
