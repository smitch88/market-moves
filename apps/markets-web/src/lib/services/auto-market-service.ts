import { randomUUID } from "crypto";
import {
  prisma,
  MarketStatus,
  BetStatus,
  BalanceReason,
  AdminAction,
  RaffleReason,
  MarketCategory,
} from "@vault/database";
import { ConstantProductAMM } from "@/lib/services/pricing-engine";
import { getPrice } from "@/lib/services/coingecko-service";
import { createPnLSnapshot } from "@/lib/services/stats-service";

const DEFAULT_LIQUIDITY = 100000;

export type CreateScheduledMarketsResult = {
  created: number;
  skipped: number;
  errors: { configId: string; message: string }[];
};

/**
 * Check if we should create a new market for this config at the current time.
 * One market per timeframe window (e.g. for 15min: one at :00, :15, :30, :45).
 */
function shouldCreateForConfig(
  config: { timeframeMinutes: number; lastCreatedAt: Date | null },
  now: Date
): boolean {
  const windowMs = config.timeframeMinutes * 60 * 1000;
  const currentWindowStart = new Date(
    Math.floor(now.getTime() / windowMs) * windowMs
  );
  if (!config.lastCreatedAt) return true;
  return config.lastCreatedAt < currentWindowStart;
}

/**
 * Format a price for display in question text (compact).
 */
function formatPrice(price: number): string {
  if (price >= 1000) return `$${Math.round(price).toLocaleString()}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  return `$${price.toFixed(4)}`;
}

/**
 * Create event slug for an auto-market (unique per token/timeframe/window).
 */
function eventSlug(
  tokenSymbol: string,
  timeframeMinutes: number,
  closesAt: Date
): string {
  const y = closesAt.getUTCFullYear();
  const m = String(closesAt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(closesAt.getUTCDate()).padStart(2, "0");
  const h = String(closesAt.getUTCHours()).padStart(2, "0");
  const min = String(closesAt.getUTCMinutes()).padStart(2, "0");
  return `${tokenSymbol.toLowerCase()}-${timeframeMinutes}min-${y}-${m}-${d}-${h}${min}`;
}

/**
 * Create and publish new markets for all active configs that are due.
 */
export async function createScheduledMarkets(): Promise<CreateScheduledMarketsResult> {
  const now = new Date();
  const configs = await prisma.autoMarketConfig.findMany({
    where: { isActive: true },
  });

  const result: CreateScheduledMarketsResult = {
    created: 0,
    skipped: 0,
    errors: [],
  };

  for (const config of configs) {
    if (!shouldCreateForConfig(config, now)) {
      result.skipped++;
      continue;
    }

    try {
      const { price } = await getPrice(config.coingeckoId);
      const closesAt = new Date(now.getTime() + config.timeframeMinutes * 60 * 1000);
      const slug = eventSlug(config.tokenSymbol, config.timeframeMinutes, closesAt);

      const thresholdStr = formatPrice(price);
      const question = `Will ${config.tokenName} be over or under ${thresholdStr} when this market closes?`;
      const outcomes = ["Over", "Under"];
      const detailsMarkdown = `Resolved by comparing price at close (${closesAt.toISOString()}) to opening price ${thresholdStr}. Over wins if price ≥ ${thresholdStr}; Under wins if price < ${thresholdStr}. Source: CoinGecko.`;

      const liquidity0 = Number(config.seed0) || DEFAULT_LIQUIDITY;
      const liquidity1 = Number(config.seed1) || DEFAULT_LIQUIDITY;
      const k = ConstantProductAMM.calculateInitialK(liquidity0, liquidity1);
      const cpmm = new ConstantProductAMM();
      const prices = cpmm.calculatePrice(liquidity0, liquidity1);
      const initialPrice0 = prices.price0.toFixed(4);
      const initialPrice1 = prices.price1.toFixed(4);

      await prisma.$transaction(async (tx) => {
        const event = await tx.event.create({
          data: {
            title: `${config.tokenSymbol} ${config.timeframeLabel}`,
            slug,
            description: `Price prediction: will ${config.tokenName} be higher or lower in ${config.timeframeLabel}?`,
            category: MarketCategory.CRYPTO,
            eventType: "PROP",
            isPublished: true,
            startTime: now,
            endTime: closesAt,
            bannerUrl: config.eventBannerUrl ?? null,
            logoUrl: config.eventLogoUrl ?? null,
          },
        });

        const market = await tx.market.create({
          data: {
            eventId: event.id,
            question,
            outcomes: JSON.stringify(outcomes),
            outcomePrices: JSON.stringify([initialPrice0, initialPrice1]),
            detailsMarkdown,
            resolutionSourceUrl: "https://www.coingecko.com/",
            opensAt: now,
            closesAt,
            feeBps: config.feeBps,
            seed0: liquidity0,
            seed1: liquidity1,
            reserve0: liquidity0,
            reserve1: liquidity1,
            k,
            status: MarketStatus.DRAFT,
            autoMarketConfigId: config.id,
            openingPrice: price,
          },
        });

        await tx.priceSnapshot.create({
          data: {
            marketId: market.id,
            price0: parseFloat(initialPrice0),
            price1: parseFloat(initialPrice1),
            pool0: liquidity0,
            pool1: liquidity1,
          },
        });

        await tx.market.update({
          where: { id: market.id },
          data: {
            status: MarketStatus.OPEN,
            isPublished: true,
            publishedAt: now,
          },
        });

        await tx.autoMarketConfig.update({
          where: { id: config.id },
          data: { lastCreatedAt: now },
        });
      });

      result.created++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.errors.push({ configId: config.id, message });
    }
  }

  return result;
}

/**
 * Get a system admin user ID for cron-originated audit logs. Required because AdminActionLog.adminUserId is not optional.
 */
async function getSystemAdminId(): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!admin) {
    throw new Error("No admin user found; required for auto-market cron audit log");
  }
  return admin.id;
}

export type ProcessExpiredMarketsResult = {
  processed: number;
  errors: { marketId: string; message: string }[];
};

/**
 * Find OPEN auto-markets whose closesAt has passed, then close, resolve (by price), and settle each.
 */
export async function processExpiredMarkets(): Promise<ProcessExpiredMarketsResult> {
  const now = new Date();
  const systemAdminId = await getSystemAdminId();

  const expired = await prisma.market.findMany({
    where: {
      autoMarketConfigId: { not: null },
      status: MarketStatus.OPEN,
      closesAt: { lt: now },
    },
    include: {
      autoMarketConfig: true,
      event: { select: { isPublished: true } },
    },
  });

  const result: ProcessExpiredMarketsResult = { processed: 0, errors: [] };

  for (const market of expired) {
    const config = market.autoMarketConfig;
    if (!config || market.openingPrice == null) {
      result.errors.push({
        marketId: market.id,
        message: "Missing autoMarketConfig or openingPrice",
      });
      continue;
    }

    try {
      const { price: closingPrice } = await getPrice(config.coingeckoId);
      const openingPrice = Number(market.openingPrice);
      const outcomeIndex = closingPrice >= openingPrice ? 0 : 1;

      await closeResolveAndSettleMarket(market.id, outcomeIndex, systemAdminId);
      result.processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      result.errors.push({ marketId: market.id, message });
    }
  }

  return result;
}

/**
 * Perform close -> resolve -> settle for a single market (same logic as admin routes).
 */
async function closeResolveAndSettleMarket(
  marketId: string,
  outcomeIndex: number,
  adminId: string
): Promise<void> {
  await closeMarket(marketId, adminId);
  await resolveMarket(marketId, outcomeIndex, adminId);
  const settleResult = await settleMarket(marketId, adminId);
  for (const userId of settleResult.affectedUserIds) {
    createPnLSnapshot(userId).catch(console.error);
  }
}

async function closeMarket(marketId: string, adminId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.market.findUnique({ where: { id: marketId } });
    if (!existing || existing.status !== MarketStatus.OPEN) return;

    const pendingBets = await tx.bet.findMany({
      where: { marketId, status: BetStatus.PENDING_TWEET },
      include: { user: { select: { id: true, balance: true } } },
    });

    for (const bet of pendingBets) {
      const refundAmount = Number(bet.amount);
      const currentBalance = Number(bet.user.balance);
      await tx.user.update({
        where: { id: bet.userId },
        data: { balance: currentBalance + refundAmount },
      });
      await tx.balanceLedger.create({
        data: {
          userId: bet.userId,
          delta: refundAmount,
          balanceBefore: currentBalance,
          balanceAfter: currentBalance + refundAmount,
          reason: BalanceReason.OTHER,
          correlationId: bet.id,
          actorAdminUserId: adminId,
        },
      });
      await tx.bet.update({
        where: { id: bet.id },
        data: { status: BetStatus.REJECTED },
      });
    }

    await tx.market.update({
      where: { id: marketId },
      data: { status: MarketStatus.CLOSED, closesAt: existing.closesAt || new Date() },
    });
    await tx.adminActionLog.create({
      data: {
        adminUserId: adminId,
        action: AdminAction.MARKET_CLOSE,
        targetType: "Market",
        targetId: marketId,
        metadata: { source: "auto-market-cron", pendingBetsRejected: pendingBets.length },
      },
    });
  });
}

async function resolveMarket(
  marketId: string,
  outcomeIndex: number,
  adminId: string
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.market.findUnique({ where: { id: marketId } });
    if (!existing || existing.status !== MarketStatus.CLOSED) return;
    if (existing.resolvedOutcome !== null) return;

    const outcomes = JSON.parse(existing.outcomes) as string[];
    const outcomeLabel = outcomes[outcomeIndex] ?? "Unknown";

    const pendingBets = await tx.bet.findMany({
      where: { marketId, status: BetStatus.PENDING_TWEET },
      include: { user: { select: { id: true, balance: true } } },
    });

    for (const bet of pendingBets) {
      const refundAmount = Number(bet.amount);
      const currentBalance = Number(bet.user.balance);
      await tx.user.update({
        where: { id: bet.userId },
        data: { balance: currentBalance + refundAmount },
      });
      await tx.balanceLedger.create({
        data: {
          userId: bet.userId,
          delta: refundAmount,
          balanceBefore: currentBalance,
          balanceAfter: currentBalance + refundAmount,
          reason: BalanceReason.OTHER,
          correlationId: bet.id,
          actorAdminUserId: adminId,
        },
      });
      await tx.bet.update({
        where: { id: bet.id },
        data: { status: BetStatus.REJECTED },
      });
    }

    await tx.market.update({
      where: { id: marketId },
      data: {
        status: MarketStatus.RESOLVED,
        resolvedOutcome: outcomeIndex,
        resolvedAt: new Date(),
      },
    });
    await tx.adminActionLog.create({
      data: {
        adminUserId: adminId,
        action: AdminAction.MARKET_RESOLVE,
        targetType: "Market",
        targetId: marketId,
        metadata: {
          outcomeIndex,
          outcomeLabel,
          source: "auto-market-cron",
        },
      },
    });
  });
}

async function settleMarket(
  marketId: string,
  adminId: string
): Promise<{ affectedUserIds: string[] }> {
  const result = await prisma.$transaction(
    async (tx) => {
      const market = await tx.market.findUnique({
        where: { id: marketId },
        include: {
          positions: { include: { user: true } },
          bets: {
            where: { status: BetStatus.CONFIRMED },
            include: { user: true },
          },
        },
      });

      if (
        !market ||
        market.status !== MarketStatus.RESOLVED ||
        market.settlementRunId ||
        market.resolvedOutcome === null
      ) {
        throw new Error("Market not in resolvable state");
      }

      const settlementRunId = randomUUID();
      const outcomes = JSON.parse(market.outcomes) as string[];
      const winningOutcomeLabel = outcomes[market.resolvedOutcome];
      const isOutcome0 = market.resolvedOutcome === 0;
      const fee = market.feeBps / 10000;
      const affectedUserIds: string[] = [];
      const pool0 = Number(market.seed0) + Number(market.pool0);
      const pool1 = Number(market.seed1) + Number(market.pool1);
      const totalPool = pool0 + pool1;
      const netPool = totalPool * (1 - fee);
      const losingPositionIds: string[] = [];

      const winningPositions = market.positions.filter((p) => {
        const winningShares = isOutcome0 ? Number(p.shares0) : Number(p.shares1);
        const losingShares = isOutcome0 ? Number(p.shares1) : Number(p.shares0);
        if (losingShares > 0) losingPositionIds.push(p.id);
        return winningShares > 0;
      });

      if (losingPositionIds.length > 0) {
        await tx.position.updateMany({
          where: { id: { in: losingPositionIds } },
          data: { claimedAt: new Date() },
        });
      }

      for (const position of winningPositions) {
        affectedUserIds.push(position.userId);
        await tx.raffleEntry.upsert({
          where: {
            userId_marketId_reason: {
              userId: position.userId,
              marketId: market.id,
              reason: RaffleReason.CORRECT_PREDICTION,
            },
          },
          update: { entries: { increment: 1 } },
          create: {
            userId: position.userId,
            marketId: market.id,
            entries: 1,
            reason: RaffleReason.CORRECT_PREDICTION,
          },
        });
      }

      const winningBetIds: string[] = [];
      const losingBetIds: string[] = [];
      const betPayouts: { id: string; payout: number }[] = [];

      for (const bet of market.bets) {
        const isWinner = bet.outcomeIndex === market.resolvedOutcome;
        if (isWinner) {
          winningBetIds.push(bet.id);
          if (bet.shares) {
            const betPayout = Math.floor(Number(bet.shares) * (1 - fee));
            if (betPayout > 0) betPayouts.push({ id: bet.id, payout: betPayout });
          }
          if (!affectedUserIds.includes(bet.userId)) affectedUserIds.push(bet.userId);
        } else {
          losingBetIds.push(bet.id);
          if (!affectedUserIds.includes(bet.userId)) affectedUserIds.push(bet.userId);
        }
      }

      if (losingBetIds.length > 0) {
        await tx.bet.updateMany({
          where: { id: { in: losingBetIds } },
          data: { status: BetStatus.LOST, payout: 0 },
        });
      }

      const winnersWithPayouts = new Set(betPayouts.map((b) => b.id));
      const winnersWithoutPayouts = winningBetIds.filter((id) => !winnersWithPayouts.has(id));
      if (winnersWithoutPayouts.length > 0) {
        await tx.bet.updateMany({
          where: { id: { in: winnersWithoutPayouts } },
          data: { status: BetStatus.WON, payout: 0 },
        });
      }
      for (const { id, payout } of betPayouts) {
        await tx.bet.update({
          where: { id },
          data: { status: BetStatus.WON, payout },
        });
      }

      const qualifiedReferrals = await tx.referral.findMany({
        where: { qualifiedAt: { not: null }, bonusEntriesAwarded: 0 },
        include: {
          referred: {
            select: {
              positions: { where: { marketId: market.id } },
            },
          },
        },
      });
      const eligibleReferrals = qualifiedReferrals.filter(
        (r) => r.referred.positions.length > 0
      );
      for (const referral of eligibleReferrals) {
        await tx.raffleEntry.upsert({
          where: {
            userId_marketId_reason: {
              userId: referral.referrerUserId,
              marketId: market.id,
              reason: RaffleReason.REFERRAL_BONUS,
            },
          },
          update: { entries: { increment: 1 } },
          create: {
            userId: referral.referrerUserId,
            marketId: market.id,
            entries: 1,
            reason: RaffleReason.REFERRAL_BONUS,
          },
        });
        await tx.referral.update({
          where: { id: referral.id },
          data: { bonusEntriesAwarded: 1 },
        });
      }

      await tx.market.update({
        where: { id: marketId },
        data: {
          status: MarketStatus.SETTLED,
          settledAt: new Date(),
          settlementRunId,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: adminId,
          action: AdminAction.MARKET_SETTLE,
          targetType: "Market",
          targetId: marketId,
          metadata: {
            settlementRunId,
            source: "auto-market-cron",
            winningOutcome: winningOutcomeLabel,
            totalPool,
            netPool,
          },
        },
      });

      return { affectedUserIds };
    },
    { timeout: 120000, maxWait: 10000 }
  );

  return result;
}
