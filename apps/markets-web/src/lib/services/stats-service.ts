/**
 * Stats Service
 * 
 * Handles user statistics calculations including:
 * - Realized PnL (from settled bets)
 * - Unrealized PnL (from open positions)
 * - Trading volume
 * - Win rate and other metrics
 */

import { prisma, BetStatus, PricingModel } from "@vault/database";

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
 * Calculate realized PnL from settled bets
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
    return total + ((bet.payout || 0) - bet.amount);
  }, 0);
}

/**
 * Calculate unrealized PnL from open positions
 * Unrealized PnL = sum of (currentValue - costBasis) for all open positions
 */
export async function calculateUnrealizedPnL(userId: string): Promise<number> {
  const positions = await prisma.position.findMany({
    where: {
      userId,
      OR: [
        { shares0: { gt: 0 } },
        { shares1: { gt: 0 } },
      ],
    },
    include: {
      market: {
        select: {
          status: true,
          pricingModel: true,
          reserve0: true,
          reserve1: true,
          outcomePrices: true,
        },
      },
    },
  });

  let unrealizedPnL = 0;

  for (const position of positions) {
    // Only count open markets
    if (position.market.status !== "OPEN" && position.market.status !== "PUBLISHED") {
      continue;
    }

    if (position.market.pricingModel === PricingModel.CPMM) {
      const totalReserve = position.market.reserve0 + position.market.reserve1;
      const price0 = position.market.reserve1 / totalReserve;
      const price1 = position.market.reserve0 / totalReserve;

      // Calculate current value and cost basis for each outcome
      if (position.shares0 > 0) {
        const currentValue = position.shares0 * price0; // Already in dollars
        const costBasis = position.shares0 * position.avgCost0; // Already in dollars
        unrealizedPnL += currentValue - costBasis;
      }

      if (position.shares1 > 0) {
        const currentValue = position.shares1 * price1; // Already in dollars
        const costBasis = position.shares1 * position.avgCost1; // Already in dollars
        unrealizedPnL += currentValue - costBasis;
      }
    } else {
      // For pari-mutuel, unrealized PnL is harder to calculate
      // Skip for now or use implied odds from outcomePrices
      try {
        const prices = JSON.parse(position.market.outcomePrices) as string[];
        const price0 = parseFloat(prices[0]) || 0.5;
        const price1 = parseFloat(prices[1]) || 0.5;

        if (position.amount0 > 0) {
          // Expected value = amount * (1/odds) if we win, 0 if we lose
          // Simplified: current value ≈ amount * currentOdds
          const currentValue = position.amount0 / price0 * price0; // This simplifies to amount
          // For pari-mutuel, unrealized PnL is 0 until settlement
        }
        // Skip pari-mutuel unrealized PnL for simplicity
      } catch {
        // Skip if prices can't be parsed
      }
    }
  }

  return Math.round(unrealizedPnL);
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

  return bets.reduce((total, bet) => total + Math.abs(bet.amount), 0);
}

/**
 * Get comprehensive user stats
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  // Get bet counts in parallel
  const [
    realizedPnL,
    unrealizedPnL,
    totalVolume,
    betCounts,
    openPositions,
  ] = await Promise.all([
    calculateRealizedPnL(userId),
    calculateUnrealizedPnL(userId),
    calculateVolume(userId),
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
    realizedPnL,
    unrealizedPnL,
    totalPnL: realizedPnL + unrealizedPnL,
    totalVolume,
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
    realizedPnL: s.realizedPnL,
    unrealizedPnL: s.unrealizedPnL,
    totalVolume: s.totalVolume,
  }));
}

/**
 * Update user's running stats (called after trades/settlements)
 */
export async function updateUserStats(
  userId: string,
  volumeDelta: number,
  realizedPnLDelta: number = 0
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      totalVolume: { increment: Math.abs(volumeDelta) },
      realizedPnL: { increment: realizedPnLDelta },
    },
  });
}
