/**
 * Trade Service
 * 
 * Handles all share trading operations for CPMM markets.
 * Designed as an abstraction layer for easy on-chain migration.
 * 
 * Current: Off-chain execution via database transactions
 * Future: On-chain execution via smart contract calls
 * 
 * NOW USING PRISMA.DECIMAL FOR EXACT PRECISION WITH REAL MONEY
 */

import { prisma, BetStatus, BalanceReason, TradeType, PricingModel, Prisma } from "@vault/database";
import type { Market, User, Bet, Position } from "@vault/database";
import { ConstantProductAMM, QuoteResult } from "./pricing-engine";
import { createPriceSnapshot } from "./price-snapshot-service";
import { broadcastPriceChange } from "./price-broadcaster";
import { updateUserStats, createPnLSnapshot } from "./stats-service";
import * as currency from "@/lib/utils/currency";

// ============================================================================
// TYPES
// ============================================================================

export interface BuySharesParams {
  userId: string;
  marketId: string;
  outcomeIndex: 0 | 1;
  amount: Prisma.Decimal; // Dollar amount to spend
  maxSlippage?: number; // Max acceptable slippage (0-1), default 0.05 (5%)
}

export interface SellSharesParams {
  userId: string;
  marketId: string;
  outcomeIndex: 0 | 1;
  shares: Prisma.Decimal; // Number of shares to sell
  minProceeds?: Prisma.Decimal; // Minimum acceptable proceeds
}

export interface QuoteParams {
  marketId: string;
  outcomeIndex: 0 | 1;
  side: "buy" | "sell";
  amount: Prisma.Decimal; // Cost for buy, shares for sell
}

export interface TradeResult {
  success: boolean;
  bet: Bet;
  shares: Prisma.Decimal;
  avgPrice: Prisma.Decimal;
  totalCost?: Prisma.Decimal; // For buys
  proceeds?: Prisma.Decimal; // For sells
  newPrices: [Prisma.Decimal, Prisma.Decimal];
  newReserves: [Prisma.Decimal, Prisma.Decimal];
  priceImpact: Prisma.Decimal;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

// ============================================================================
// TRADE SERVICE
// ============================================================================

export class TradeService {
  private cpmm: ConstantProductAMM;

  constructor() {
    this.cpmm = new ConstantProductAMM();
  }

  /**
   * Get a quote for a trade without executing it
   */
  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const { marketId, outcomeIndex, side, amount } = params;

    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new Error("Market not found");
    }

    if (market.pricingModel !== PricingModel.CPMM) {
      throw new Error("Market does not support share trading");
    }

    if (!market.k) {
      throw new Error("Market k-invariant not set");
    }

    return this.cpmm.getQuote({
      side,
      outcomeIndex: outcomeIndex as 0 | 1,
      amount,
      reserve0: market.reserve0,
      reserve1: market.reserve1,
      k: market.k,
      feeBps: market.feeBps,
    });
  }

  /**
   * Get recommended slippage tolerance based on market liquidity
   * This provides better UX for low-liquidity markets
   */
  private getRecommendedSlippage(totalLiquidity: number): number {
    if (totalLiquidity >= 100000) {
      // High liquidity (>$100k): 10% max slippage
      return 0.10;
    } else if (totalLiquidity >= 50000) {
      // Medium-high liquidity ($50k-$100k): 20% max slippage
      return 0.20;
    } else if (totalLiquidity >= 20000) {
      // Medium liquidity ($20k-$50k): 50% max slippage
      return 0.50;
    } else if (totalLiquidity >= 10000) {
      // Low liquidity ($10k-$20k): 200% max slippage
      return 2.00;
    } else {
      // Very low liquidity (<$10k): 2000% max slippage
      // Allows trading on extremely thin markets but warns users
      return 20.00;
    }
  }

  /**
   * Validate a trade before execution
   */
  async validateTrade(
    params: BuySharesParams | SellSharesParams,
    side: "buy" | "sell"
  ): Promise<ValidationResult> {
    const { userId, marketId, outcomeIndex } = params;

    // Check market exists and is open
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      return { valid: false, error: "Market not found", code: "MARKET_NOT_FOUND" };
    }

    if (market.pricingModel !== PricingModel.CPMM) {
      return { valid: false, error: "Market does not support share trading", code: "NOT_CPMM" };
    }

    if (market.status !== "OPEN" && market.status !== "PUBLISHED") {
      return { valid: false, error: "Market is not open for trading", code: "MARKET_CLOSED" };
    }

    if (market.closesAt && new Date(market.closesAt) < new Date()) {
      return { valid: false, error: "Market has closed", code: "MARKET_EXPIRED" };
    }

    if (!market.k) {
      return { valid: false, error: "Market k-invariant not set", code: "NO_K_VALUE" };
    }

    // Check user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true, balanceLocked: true },
    });

    if (!user) {
      return { valid: false, error: "User not found", code: "USER_NOT_FOUND" };
    }

    if (user.balanceLocked) {
      return { valid: false, error: "Account is locked", code: "ACCOUNT_LOCKED" };
    }

    if (side === "buy") {
      const buyParams = params as BuySharesParams;
      if (currency.isLessThan(user.balance, buyParams.amount)) {
        return { valid: false, error: "Insufficient balance", code: "INSUFFICIENT_BALANCE" };
      }

      // Check liquidity
      const reserve = outcomeIndex === 0 ? market.reserve0 : market.reserve1;
      const otherReserve = outcomeIndex === 0 ? market.reserve1 : market.reserve0;
      
      try {
        this.cpmm.getSharesForCost(buyParams.amount, reserve, otherReserve, market.k);
      } catch {
        return { valid: false, error: "Insufficient liquidity", code: "INSUFFICIENT_LIQUIDITY" };
      }
    }

    if (side === "sell") {
      const sellParams = params as SellSharesParams;
      
      // Check user has enough shares
      const position = await prisma.position.findUnique({
        where: {
          userId_marketId: { userId, marketId },
        },
      });

      const userShares = outcomeIndex === 0 
        ? (position?.shares0 || currency.zero()) 
        : (position?.shares1 || currency.zero());

      if (currency.isLessThan(userShares, sellParams.shares)) {
        return { valid: false, error: "Insufficient shares", code: "INSUFFICIENT_SHARES" };
      }
    }

    return { valid: true };
  }

  /**
   * Create a pending buy order (requires tweet verification)
   * 
   * This creates a bet in PENDING_TWEET status. The actual share purchase
   * happens when the tweet is verified.
   */
  async createBuyOrder(params: BuySharesParams): Promise<{
    bet: Bet;
    quote: QuoteResult;
  }> {
    const { userId, marketId, outcomeIndex, amount, maxSlippage = 0.05 } = params;

    // Validate
    const validation = await this.validateTrade(params, "buy");
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Get market for liquidity check
    const market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      throw new Error("Market not found");
    }

    // Get quote
    const quote = await this.getQuote({
      marketId,
      outcomeIndex,
      side: "buy",
      amount,
    });

    // Dynamic slippage based on market liquidity
    const totalLiquidity = currency.toNumber(currency.add(market.reserve0, market.reserve1));
    const recommendedMaxSlippage = this.getRecommendedSlippage(totalLiquidity);
    const effectiveMaxSlippage = Math.max(maxSlippage, recommendedMaxSlippage);
    
    // Check slippage with dynamic limit
    const priceImpactNum = currency.toNumber(quote.priceImpact);
    if (priceImpactNum > effectiveMaxSlippage) {
      throw new Error(`Price impact ${(priceImpactNum * 100).toFixed(2)}% exceeds max slippage ${(effectiveMaxSlippage * 100).toFixed(2)}%`);
    }

    // Get user for balance
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true },
    });

    if (!user) {
      throw new Error("User not found");
    }

    // Create pending bet and debit balance in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the bet (pending tweet verification)
      const bet = await tx.bet.create({
        data: {
          userId,
          marketId,
          outcomeIndex,
          tradeType: TradeType.BUY,
          amount,
          shares: quote.outputAmount,
          pricePerShare: quote.avgPrice,
          status: BetStatus.PENDING_TWEET,
        },
      });

      // Debit user balance
      const newBalance = currency.subtract(user.balance, amount);
      await tx.user.update({
        where: { id: userId },
        data: { balance: newBalance },
      });

      // Create balance ledger entry
      await tx.balanceLedger.create({
        data: {
          userId,
          delta: currency.multiply(amount, currency.decimal("-1")),
          balanceBefore: user.balance,
          balanceAfter: newBalance,
          reason: BalanceReason.BET_PLACED,
          correlationId: bet.id,
        },
      });

      return bet;
    });

    return { bet: result, quote };
  }

  /**
   * Execute a confirmed buy (called after tweet verification)
   * 
   * This updates the market reserves and user position.
   */
  async executeBuy(
    tx: Prisma.TransactionClient,
    bet: Bet,
    market: Market
  ): Promise<TradeResult> {
    if (!market.k) {
      throw new Error("Market k-invariant not set");
    }

    const outcomeIndex = bet.outcomeIndex as 0 | 1;
    const reserve = outcomeIndex === 0 ? market.reserve0 : market.reserve1;
    const otherReserve = outcomeIndex === 0 ? market.reserve1 : market.reserve0;

    // Calculate shares for the cost (minus fee)
    const feeAmount = currency.calculateFee(bet.amount, market.feeBps);
    const costAfterFee = currency.subtract(bet.amount, feeAmount);

    const result = this.cpmm.getSharesForCost(costAfterFee, reserve, otherReserve, market.k);

    // Update market reserves
    const newReserve0 = outcomeIndex === 0 ? result.newReserve : result.newOtherReserve;
    const newReserve1 = outcomeIndex === 0 ? result.newOtherReserve : result.newReserve;

    const updatedMarket = await tx.market.update({
      where: { id: market.id },
      data: {
        reserve0: newReserve0,
        reserve1: newReserve1,
        // Also update pool for tracking (optional, for consistency)
        pool0: outcomeIndex === 0 ? { increment: bet.amount } : undefined,
        pool1: outcomeIndex === 1 ? { increment: bet.amount } : undefined,
      },
    });

    // Calculate and persist new prices
    const prices = this.cpmm.calculatePrice(newReserve0, newReserve1);
    await tx.market.update({
      where: { id: market.id },
      data: {
        outcomePrices: JSON.stringify([
          currency.toNumber(prices.price0).toFixed(4), 
          currency.toNumber(prices.price1).toFixed(4)
        ]),
      },
    });

    // Update or create position
    const position = await tx.position.findUnique({
      where: {
        userId_marketId: { userId: bet.userId, marketId: market.id },
      },
    });

    const currentShares = outcomeIndex === 0 
      ? (position?.shares0 || currency.zero()) 
      : (position?.shares1 || currency.zero());
    const currentAvgCost = outcomeIndex === 0 
      ? (position?.avgCost0 || currency.zero()) 
      : (position?.avgCost1 || currency.zero());

    // Calculate new average cost
    const newTotalShares = currency.add(currentShares, result.shares);
    const newAvgCost = currency.isGreaterThan(newTotalShares, 0)
      ? currency.divide(
          currency.add(
            currency.multiply(currentShares, currentAvgCost),
            currency.multiply(result.shares, result.avgPrice)
          ),
          newTotalShares
        )
      : currency.zero();

    await tx.position.upsert({
      where: {
        userId_marketId: { userId: bet.userId, marketId: market.id },
      },
      update: {
        ...(outcomeIndex === 0
          ? {
              shares0: { increment: result.shares },
              avgCost0: newAvgCost,
              // Also update legacy amount fields
              amount0: { increment: bet.amount },
              weighted0: { increment: currency.toNumber(bet.amount) * bet.weight },
            }
          : {
              shares1: { increment: result.shares },
              avgCost1: newAvgCost,
              amount1: { increment: bet.amount },
              weighted1: { increment: currency.toNumber(bet.amount) * bet.weight },
            }),
        lastBetAt: new Date(),
      },
      create: {
        userId: bet.userId,
        marketId: market.id,
        shares0: outcomeIndex === 0 ? result.shares : currency.zero(),
        shares1: outcomeIndex === 1 ? result.shares : currency.zero(),
        avgCost0: outcomeIndex === 0 ? result.avgPrice : currency.zero(),
        avgCost1: outcomeIndex === 1 ? result.avgPrice : currency.zero(),
        amount0: outcomeIndex === 0 ? bet.amount : currency.zero(),
        amount1: outcomeIndex === 1 ? bet.amount : currency.zero(),
        weighted0: outcomeIndex === 0 ? currency.toNumber(bet.amount) * bet.weight : 0,
        weighted1: outcomeIndex === 1 ? currency.toNumber(bet.amount) * bet.weight : 0,
        lastBetAt: new Date(),
      },
    });

    // Update bet with final shares and price
    await tx.bet.update({
      where: { id: bet.id },
      data: {
        shares: result.shares,
        pricePerShare: result.avgPrice,
      },
    });

    // Create price snapshot
    await createPriceSnapshot(
      tx,
      market.id,
      newReserve0,
      newReserve1,
      market.seed0,
      market.seed1
    );

    // Broadcast price change with reserves for CPMM
    broadcastPriceChange(
      market.id,
      market.eventId,
      [prices.price0, prices.price1],
      [newReserve0, newReserve1],
      {
        reserves: [newReserve0, newReserve1],
        k: market.k || undefined,
        pricingModel: "CPMM",
      }
    );

    // Update user volume stats (fire-and-forget, don't block trade)
    updateUserStats(bet.userId, bet.amount).catch(console.error);
    
    // Create PnL snapshot if rate limit allows (fire-and-forget)
    createPnLSnapshot(bet.userId).catch(console.error);

    return {
      success: true,
      bet,
      shares: result.shares,
      avgPrice: result.avgPrice,
      totalCost: bet.amount,
      newPrices: [prices.price0, prices.price1],
      newReserves: [newReserve0, newReserve1],
      priceImpact: result.priceImpact,
    };
  }

  /**
   * Execute a sell order (no tweet required, immediate execution)
   */
  async executeSell(params: SellSharesParams): Promise<TradeResult> {
    const { userId, marketId, outcomeIndex, shares, minProceeds } = params;

    // Validate
    const validation = await this.validateTrade(params, "sell");
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const market = await prisma.market.findUnique({
      where: { id: marketId },
      include: { event: { select: { id: true } } },
    });

    if (!market || !market.k) {
      throw new Error("Market not found or k-invariant not set");
    }

    const reserve = outcomeIndex === 0 ? market.reserve0 : market.reserve1;
    const otherReserve = outcomeIndex === 0 ? market.reserve1 : market.reserve0;

    // Calculate proceeds
    const sellResult = this.cpmm.getSellProceeds(shares, reserve, otherReserve, market.k);
    
    // Apply fee
    const feeAmount = currency.calculateFee(sellResult.proceeds, market.feeBps);
    const proceedsAfterFee = currency.floor(currency.subtract(sellResult.proceeds, feeAmount));

    // Check minimum proceeds
    if (minProceeds !== undefined && currency.isLessThan(proceedsAfterFee, minProceeds)) {
      throw new Error(`Proceeds ${currency.formatCurrency(proceedsAfterFee)} below minimum ${currency.formatCurrency(minProceeds)}`);
    }

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update market reserves
      const newReserve0 = outcomeIndex === 0 ? sellResult.newReserve : sellResult.newOtherReserve;
      const newReserve1 = outcomeIndex === 0 ? sellResult.newOtherReserve : sellResult.newReserve;

      await tx.market.update({
        where: { id: marketId },
        data: {
          reserve0: newReserve0,
          reserve1: newReserve1,
        },
      });

      // Calculate and persist new prices
      const prices = this.cpmm.calculatePrice(newReserve0, newReserve1);
      await tx.market.update({
        where: { id: marketId },
        data: {
          outcomePrices: JSON.stringify([
            currency.toNumber(prices.price0).toFixed(4), 
            currency.toNumber(prices.price1).toFixed(4)
          ]),
        },
      });

      // Update position (reduce shares and also clear amount for CPMM)
      const position = await tx.position.findUnique({
        where: {
          userId_marketId: { userId, marketId },
        },
      });

      if (!position) {
        throw new Error("Position not found");
      }

      // Calculate realized PnL from this sell
      // Realized PnL = proceeds - (shares sold × average cost per share)
      const avgCost = outcomeIndex === 0 ? position.avgCost0 : position.avgCost1;
      const costBasis = currency.multiply(shares, avgCost);
      const realizedPnL = currency.subtract(proceedsAfterFee, costBasis);

      const newShares0 = outcomeIndex === 0 ? currency.subtract(position.shares0, shares) : position.shares0;
      const newShares1 = outcomeIndex === 1 ? currency.subtract(position.shares1, shares) : position.shares1;

      await tx.position.update({
        where: { id: position.id },
        data: {
          ...(outcomeIndex === 0
            ? { 
                shares0: newShares0,
                // Clear amount0 when selling all shares (for legacy compatibility)
                amount0: currency.isZero(newShares0) ? currency.zero() : position.amount0,
              }
            : { 
                shares1: newShares1,
                // Clear amount1 when selling all shares (for legacy compatibility)
                amount1: currency.isZero(newShares1) ? currency.zero() : position.amount1,
              }),
          lastBetAt: new Date(),
        },
      });

      // Get user and update balance + realized PnL in single operation
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { balance: true, realizedPnL: true },
      });

      if (!user) {
        throw new Error("User not found");
      }

      const newBalance = currency.add(user.balance, proceedsAfterFee);
      const newRealizedPnL = currency.add(user.realizedPnL, realizedPnL);

      await tx.user.update({
        where: { id: userId },
        data: {
          balance: newBalance,
          realizedPnL: newRealizedPnL,
        },
      });

      // Create PnL ledger entry for audit trail
      await tx.pnLLedger.create({
        data: {
          userId,
          delta: realizedPnL,
          pnlBefore: user.realizedPnL,
          pnlAfter: newRealizedPnL,
          reason: "TRADE_SELL",
          correlationId: `sell-${marketId}-${Date.now()}`,
          marketId,
          metadata: {
            shares: currency.toNumber(shares),
            proceeds: currency.toNumber(proceedsAfterFee),
            avgCost: currency.toNumber(avgCost),
            costBasis: currency.toNumber(costBasis),
            outcomeIndex,
          },
        },
      });

      // Create balance ledger entry
      await tx.balanceLedger.create({
        data: {
          userId,
          delta: proceedsAfterFee,
          balanceBefore: user.balance,
          balanceAfter: newBalance,
          reason: BalanceReason.TRADE_SELL,
          correlationId: `sell-${marketId}-${Date.now()}`,
        },
      });

      // Create bet record for the sell
      const bet = await tx.bet.create({
        data: {
          userId,
          marketId,
          outcomeIndex,
          tradeType: TradeType.SELL,
          amount: currency.multiply(proceedsAfterFee, currency.decimal("-1")), // Negative to indicate proceeds
          shares: currency.multiply(shares, currency.decimal("-1")), // Negative to indicate sell
          pricePerShare: sellResult.avgPrice,
          status: BetStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      // Create price snapshot
      await createPriceSnapshot(
        tx,
        marketId,
        newReserve0,
        newReserve1,
        market.seed0,
        market.seed1
      );

      // Broadcast price change with reserves for CPMM
      broadcastPriceChange(
        marketId,
        market.eventId,
        [prices.price0, prices.price1],
        [newReserve0, newReserve1],
        {
          reserves: [newReserve0, newReserve1],
          k: market.k || undefined,
          pricingModel: "CPMM",
        }
      );

      return {
        bet,
        prices,
        newReserve0,
        newReserve1,
      };
    });

    // Update user volume stats (fire-and-forget, don't block trade)
    updateUserStats(userId, proceedsAfterFee).catch(console.error);
    
    // Create PnL snapshot if rate limit allows (fire-and-forget)
    createPnLSnapshot(userId).catch(console.error);

    return {
      success: true,
      bet: result.bet,
      shares,
      avgPrice: sellResult.avgPrice,
      proceeds: proceedsAfterFee,
      newPrices: [result.prices.price0, result.prices.price1],
      newReserves: [result.newReserve0, result.newReserve1],
      priceImpact: sellResult.priceImpact,
    };
  }
}

// Singleton instance
export const tradeService = new TradeService();
