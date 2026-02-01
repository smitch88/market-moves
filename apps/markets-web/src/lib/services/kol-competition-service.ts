/**
 * KOL Daily Competition Service
 * 
 * Handles the daily KOL competition:
 * - Calculates daily winner based on follower performance
 * - Awards XP bonuses to winning KOL and their followers
 * - Creates DailyKOLSnapshot records for tracking
 */

import { prisma, XPReason, BetStatus, Prisma } from "@vault/database";

// ============================================================================
// CONFIGURATION
// ============================================================================

// XP awards for daily competition
const DAILY_KOL_WINNER_XP = 50000; // 50k XP to winning KOL
const FOLLOWER_XP_SHARE_PERCENT = 10; // Followers get 10% of what KOL gets (5k each)

// XP rate for captain market volume (1/10th of normal rate)
// Normal rate is 10 XP per $1, so captains get 1 XP per $1 of volume on their markets
const KOL_MARKET_VOLUME_XP_PER_DOLLAR = 1;

// ============================================================================
// TYPES
// ============================================================================

export interface KOLDailyPerformance {
  kolUserId: string;
  followerPnL: number;
  followerVolume: number;
  followerCount: number;
}

export interface CompetitionResult {
  date: Date;
  winner: {
    kolUserId: string;
    handle: string | null;
    name: string | null;
    followerPnL: number;
    followerVolume: number;
    followerCount: number;
    xpAwarded: number;
  } | null;
  allParticipants: KOLDailyPerformance[];
  followersRewarded: number;
  totalXpDistributed: number;
}

export interface KOLMarketVolumeResult {
  kolUserId: string;
  handle: string | null;
  name: string | null;
  dailyVolume: number;
  xpAwarded: number;
}

export interface DailyKOLMarketVolumeResults {
  date: Date;
  results: KOLMarketVolumeResult[];
  totalXpDistributed: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the start of today (midnight UTC)
 */
function getStartOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Get the start of yesterday (midnight UTC)
 */
function getStartOfYesterday(): Date {
  const today = getStartOfToday();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

// ============================================================================
// COMPETITION LOGIC
// ============================================================================

/**
 * Calculate daily performance for all KOLs based on their followers' activity
 */
export async function calculateDailyKOLPerformance(
  date: Date
): Promise<KOLDailyPerformance[]> {
  const startOfDay = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate()
  ));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  // Get all KOLs
  const kols = await prisma.user.findMany({
    where: { isKOL: true },
    select: {
      id: true,
      followers: {
        select: { id: true },
      },
    },
  });

  const performances: KOLDailyPerformance[] = [];

  for (const kol of kols) {
    const followerIds = kol.followers.map((f) => f.id);
    
    if (followerIds.length === 0) {
      performances.push({
        kolUserId: kol.id,
        followerPnL: 0,
        followerVolume: 0,
        followerCount: 0,
      });
      continue;
    }

    // Get follower volume for the day
    const volumeAgg = await prisma.bet.aggregate({
      where: {
        userId: { in: followerIds },
        status: BetStatus.CONFIRMED,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      _sum: { amount: true },
    });

    // Get follower PnL from settled bets for the day
    const settledBets = await prisma.bet.findMany({
      where: {
        userId: { in: followerIds },
        status: { in: [BetStatus.WON, BetStatus.LOST] },
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
        payout: { not: null },
        tradeType: "BUY",
      },
      select: {
        amount: true,
        payout: true,
      },
    });

    let followerPnL = 0;
    for (const bet of settledBets) {
      followerPnL += Number(bet.payout ?? 0) - Number(bet.amount);
    }

    performances.push({
      kolUserId: kol.id,
      followerPnL: Math.round(followerPnL),
      followerVolume: Number(volumeAgg._sum.amount ?? 0),
      followerCount: followerIds.length,
    });
  }

  return performances;
}

/**
 * Run the daily KOL competition
 * Should be called once per day, typically at midnight UTC
 */
export async function runDailyKOLCompetition(
  forDate?: Date
): Promise<CompetitionResult> {
  // Default to yesterday if no date specified
  const competitionDate = forDate || getStartOfYesterday();
  const dateOnly = new Date(Date.UTC(
    competitionDate.getUTCFullYear(),
    competitionDate.getUTCMonth(),
    competitionDate.getUTCDate()
  ));

  // Check if competition was already run for this date
  const existingSnapshot = await prisma.dailyKOLSnapshot.findFirst({
    where: {
      date: dateOnly,
      isWinner: true,
    },
  });

  if (existingSnapshot) {
    throw new Error(`Competition already run for ${dateOnly.toISOString().split("T")[0]}`);
  }

  // Calculate daily performance for all KOLs
  const performances = await calculateDailyKOLPerformance(competitionDate);

  // Filter to KOLs with at least some follower activity
  const activeKOLs = performances.filter(
    (p) => p.followerVolume > 0 || p.followerPnL !== 0
  );

  // Determine winner based on follower volume (primary metric)
  // Tiebreaker: follower PnL
  const sortedKOLs = [...activeKOLs].sort((a, b) => {
    if (b.followerVolume !== a.followerVolume) {
      return b.followerVolume - a.followerVolume;
    }
    return b.followerPnL - a.followerPnL;
  });

  const winner = sortedKOLs[0] || null;
  let totalXpDistributed = 0;
  let followersRewarded = 0;

  // Create snapshots for all participants and award XP to winner
  await prisma.$transaction(async (tx) => {
    // Create snapshots for all KOLs
    for (const perf of performances) {
      const isWinner = winner && perf.kolUserId === winner.kolUserId;
      let xpBonus = 0;

      if (isWinner && winner) {
        xpBonus = DAILY_KOL_WINNER_XP;
        totalXpDistributed += xpBonus;

        // Award XP to winning KOL
        const kolUser = await tx.user.findUnique({
          where: { id: winner.kolUserId },
          select: { xp: true },
        });

        if (kolUser) {
          const xpBefore = kolUser.xp;
          const xpAfter = xpBefore + xpBonus;

          await tx.user.update({
            where: { id: winner.kolUserId },
            data: { xp: xpAfter },
          });

          await tx.xPLedger.create({
            data: {
              userId: winner.kolUserId,
              delta: xpBonus,
              xpBefore,
              xpAfter,
              reason: XPReason.KOL_DAILY_WIN,
              correlationId: `kol-daily-win-${dateOnly.toISOString().split("T")[0]}`,
            },
          });
        }

        // Award XP to followers of the winning KOL
        const followers = await tx.user.findMany({
          where: { captainId: winner.kolUserId },
          select: { id: true, xp: true },
        });

        const followerBonus = Math.floor(DAILY_KOL_WINNER_XP * FOLLOWER_XP_SHARE_PERCENT / 100);

        for (const follower of followers) {
          const fXpBefore = follower.xp;
          const fXpAfter = fXpBefore + followerBonus;

          await tx.user.update({
            where: { id: follower.id },
            data: { xp: fXpAfter },
          });

          await tx.xPLedger.create({
            data: {
              userId: follower.id,
              delta: followerBonus,
              xpBefore: fXpBefore,
              xpAfter: fXpAfter,
              reason: XPReason.KOL_FOLLOWER_BONUS,
              correlationId: `kol-follower-bonus-${dateOnly.toISOString().split("T")[0]}-${winner.kolUserId}`,
            },
          });

          totalXpDistributed += followerBonus;
          followersRewarded++;
        }
      }

      // Create snapshot record
      await tx.dailyKOLSnapshot.create({
        data: {
          date: dateOnly,
          kolUserId: perf.kolUserId,
          followerPnL: new Prisma.Decimal(perf.followerPnL),
          followerVolume: new Prisma.Decimal(perf.followerVolume),
          followerCount: perf.followerCount,
          xpBonusAwarded: xpBonus,
          isWinner: isWinner || false,
        },
      });
    }
  });

  // Get winner details for the result
  let winnerDetails = null;
  if (winner) {
    const kolUser = await prisma.user.findUnique({
      where: { id: winner.kolUserId },
      select: { handle: true, name: true },
    });

    winnerDetails = {
      kolUserId: winner.kolUserId,
      handle: kolUser?.handle || null,
      name: kolUser?.name || null,
      followerPnL: winner.followerPnL,
      followerVolume: winner.followerVolume,
      followerCount: winner.followerCount,
      xpAwarded: DAILY_KOL_WINNER_XP,
    };
  }

  return {
    date: dateOnly,
    winner: winnerDetails,
    allParticipants: performances,
    followersRewarded,
    totalXpDistributed,
  };
}

/**
 * Get daily competition history
 */
export async function getDailyCompetitionHistory(
  days: number = 7
): Promise<{
  date: Date;
  winner: {
    kolUserId: string;
    handle: string | null;
    name: string | null;
    profileImageUrl: string | null;
    xpBonusAwarded: number;
    followerVolume: number;
  } | null;
}[]> {
  const snapshots = await prisma.dailyKOLSnapshot.findMany({
    where: { isWinner: true },
    orderBy: { date: "desc" },
    take: days,
    include: {
      kolUser: {
        select: {
          id: true,
          handle: true,
          name: true,
          profileImageUrl: true,
        },
      },
    },
  });

  return snapshots.map((s) => ({
    date: s.date,
    winner: {
      kolUserId: s.kolUser.id,
      handle: s.kolUser.handle,
      name: s.kolUser.name,
      profileImageUrl: s.kolUser.profileImageUrl,
      xpBonusAwarded: s.xpBonusAwarded,
      followerVolume: Number(s.followerVolume),
    },
  }));
}

/**
 * Get a KOL's competition stats
 */
export async function getKOLCompetitionStats(kolUserId: string): Promise<{
  totalWins: number;
  totalXpEarned: number;
  bestDayVolume: number;
  bestDayPnL: number;
}> {
  const snapshots = await prisma.dailyKOLSnapshot.findMany({
    where: { kolUserId },
    select: {
      isWinner: true,
      xpBonusAwarded: true,
      followerVolume: true,
      followerPnL: true,
    },
  });

  let totalWins = 0;
  let totalXpEarned = 0;
  let bestDayVolume = 0;
  let bestDayPnL = 0;

  for (const s of snapshots) {
    if (s.isWinner) totalWins++;
    totalXpEarned += s.xpBonusAwarded;
    bestDayVolume = Math.max(bestDayVolume, Number(s.followerVolume));
    bestDayPnL = Math.max(bestDayPnL, Number(s.followerPnL));
  }

  return {
    totalWins,
    totalXpEarned,
    bestDayVolume,
    bestDayPnL,
  };
}

// ============================================================================
// CAPTAIN MARKET VOLUME XP
// ============================================================================

/**
 * Calculate and award XP to captains based on volume from their attributed events/markets
 * Captains get 1 XP per $1 of volume (1/10th of normal trader rate)
 * This runs daily as part of the cron job
 */
export async function calculateAndAwardKOLMarketVolumeXP(
  forDate?: Date
): Promise<DailyKOLMarketVolumeResults> {
  // Default to yesterday if no date specified
  const targetDate = forDate || getStartOfYesterday();
  const startOfDay = new Date(Date.UTC(
    targetDate.getUTCFullYear(),
    targetDate.getUTCMonth(),
    targetDate.getUTCDate()
  ));
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

  // Find all events that have a captain assigned
  const eventsWithCaptains = await prisma.event.findMany({
    where: {
      createdByKolId: { not: null },
    },
    select: {
      id: true,
      createdByKolId: true,
      createdByKol: {
        select: {
          id: true,
          handle: true,
          name: true,
          xp: true,
        },
      },
      markets: {
        select: {
          id: true,
        },
      },
    },
  });

  // Group events by KOL
  const kolEventsMap = new Map<string, {
    kol: { id: string; handle: string | null; name: string | null; xp: number };
    marketIds: string[];
  }>();

  for (const event of eventsWithCaptains) {
    if (!event.createdByKolId || !event.createdByKol) continue;

    const existing = kolEventsMap.get(event.createdByKolId);
    const marketIds = event.markets.map(m => m.id);

    if (existing) {
      existing.marketIds.push(...marketIds);
    } else {
      kolEventsMap.set(event.createdByKolId, {
        kol: event.createdByKol,
        marketIds,
      });
    }
  }

  // Also check for markets directly attributed to KOLs (not through events)
  const allMarketsWithCaptains = await prisma.market.findMany({
    where: {
      createdByKolId: { not: null },
    },
    select: {
      id: true,
      createdByKolId: true,
      eventId: true,
    },
  });
  
  // Filter to only standalone markets (not part of an event)
  const marketsWithCaptains = allMarketsWithCaptains.filter(m => !m.eventId);

  // Get unique KOL IDs from standalone markets
  const standaloneKolIds = [...new Set(marketsWithCaptains.map(m => m.createdByKolId).filter(Boolean))] as string[];
  
  // Fetch KOL data for these
  const standaloneKols = standaloneKolIds.length > 0 
    ? await prisma.user.findMany({
        where: { id: { in: standaloneKolIds } },
        select: { id: true, handle: true, name: true, xp: true },
      })
    : [];
  
  const standaloneKolMap = new Map(standaloneKols.map(k => [k.id, k]));

  for (const market of marketsWithCaptains) {
    if (!market.createdByKolId) continue;
    
    const kol = standaloneKolMap.get(market.createdByKolId);
    if (!kol) continue;

    const existing = kolEventsMap.get(market.createdByKolId);
    if (existing) {
      existing.marketIds.push(market.id);
    } else {
      kolEventsMap.set(market.createdByKolId, {
        kol,
        marketIds: [market.id],
      });
    }
  }

  const results: KOLMarketVolumeResult[] = [];
  let totalXpDistributed = 0;

  // Calculate volume and award XP for each KOL
  for (const [kolId, data] of kolEventsMap) {
    if (data.marketIds.length === 0) continue;

    // Get volume from bets on these markets for the target day
    const volumeAgg = await prisma.bet.aggregate({
      where: {
        marketId: { in: data.marketIds },
        status: BetStatus.CONFIRMED,
        createdAt: {
          gte: startOfDay,
          lt: endOfDay,
        },
        tradeType: "BUY", // Only count buys, not sells (to avoid double counting)
      },
      _sum: { amount: true },
    });

    const dailyVolume = Number(volumeAgg._sum.amount ?? 0);
    
    if (dailyVolume <= 0) {
      results.push({
        kolUserId: kolId,
        handle: data.kol.handle,
        name: data.kol.name,
        dailyVolume: 0,
        xpAwarded: 0,
      });
      continue;
    }

    // Calculate XP to award (1 XP per $1)
    const xpToAward = Math.floor(dailyVolume * KOL_MARKET_VOLUME_XP_PER_DOLLAR);

    if (xpToAward > 0) {
      // Award XP in a transaction
      await prisma.$transaction(async (tx) => {
        const kolUser = await tx.user.findUnique({
          where: { id: kolId },
          select: { xp: true },
        });

        if (!kolUser) return;

        const xpBefore = kolUser.xp;
        const xpAfter = xpBefore + xpToAward;

        await tx.user.update({
          where: { id: kolId },
          data: { xp: xpAfter },
        });

        await tx.xPLedger.create({
          data: {
            userId: kolId,
            delta: xpToAward,
            xpBefore,
            xpAfter,
            // Using string literal as XPReason.KOL_MARKET_VOLUME needs prisma generate
            reason: "KOL_MARKET_VOLUME" as XPReason,
            correlationId: `kol-market-volume-${startOfDay.toISOString().split("T")[0]}`,
          },
        });
      });

      totalXpDistributed += xpToAward;
    }

    results.push({
      kolUserId: kolId,
      handle: data.kol.handle,
      name: data.kol.name,
      dailyVolume,
      xpAwarded: xpToAward,
    });
  }

  console.log(`[KOL Market Volume] Awarded ${totalXpDistributed} XP to ${results.filter(r => r.xpAwarded > 0).length} captains for date ${startOfDay.toISOString().split("T")[0]}`);

  return {
    date: startOfDay,
    results,
    totalXpDistributed,
  };
}
