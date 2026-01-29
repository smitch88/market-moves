/**
 * Pricing Engine Interface
 * 
 * This abstraction allows swapping between different pricing mechanisms:
 * - ConstantProductAMM (shares-based trading)
 * - OnChainAMMPricing (future on-chain integration)
 * 
 * Designed for easy migration to on-chain AMM contracts.
 * 
 * NOW USING PRISMA.DECIMAL FOR EXACT PRECISION WITH REAL MONEY
 */

import { Prisma } from '@vault/database';
import * as currency from '@/lib/utils/currency';

// ============================================================================
// SHARED TYPES
// ============================================================================

export interface PriceResult {
  price0: Prisma.Decimal; // Probability of outcome 0 (0-1)
  price1: Prisma.Decimal; // Probability of outcome 1 (0-1)
}

export interface PayoutResult {
  payout: Prisma.Decimal;
  netPool: Prisma.Decimal;
  fee: Prisma.Decimal;
}

// ============================================================================
// CPMM-SPECIFIC TYPES
// ============================================================================

export interface BuyCostResult {
  cost: Prisma.Decimal;           // Total cost in dollars
  avgPrice: Prisma.Decimal;       // Average price per share
  shares: Prisma.Decimal;         // Shares being purchased
  newReserve: Prisma.Decimal;     // New reserve for the purchased outcome
  newOtherReserve: Prisma.Decimal; // New reserve for the other outcome
  priceImpact: Prisma.Decimal;    // Price impact as percentage (0-1)
}

export interface SharesForCostResult {
  shares: Prisma.Decimal;         // Shares received
  avgPrice: Prisma.Decimal;       // Average price per share
  cost: Prisma.Decimal;           // Cost spent
  newReserve: Prisma.Decimal;     // New reserve for the purchased outcome
  newOtherReserve: Prisma.Decimal; // New reserve for the other outcome
  priceImpact: Prisma.Decimal;    // Price impact as percentage (0-1)
}

export interface SellResult {
  proceeds: Prisma.Decimal;       // Dollars received
  avgPrice: Prisma.Decimal;       // Average price per share
  shares: Prisma.Decimal;         // Shares being sold
  newReserve: Prisma.Decimal;     // New reserve for the sold outcome
  newOtherReserve: Prisma.Decimal; // New reserve for the other outcome
  priceImpact: Prisma.Decimal;    // Price impact as percentage (0-1)
}

export interface QuoteResult {
  side: "buy" | "sell";
  outcomeIndex: number;
  inputAmount: Prisma.Decimal;    // Cost (for buy) or shares (for sell)
  outputAmount: Prisma.Decimal;   // Shares (for buy) or proceeds (for sell)
  avgPrice: Prisma.Decimal;
  priceImpact: Prisma.Decimal;
  newPrices: PriceResult;
  feeBps: number;
  feeAmount: Prisma.Decimal;
}

// ============================================================================
// PRICING ENGINE INTERFACE
// ============================================================================

export interface PricingEngine {
  /**
   * Calculate current prices for both outcomes
   */
  calculatePrice(pool0: Prisma.Decimal, pool1: Prisma.Decimal): PriceResult;

  /**
   * Calculate payout for a winning bet/position
   */
  calculatePayout(
    stake: Prisma.Decimal,
    winningPool: Prisma.Decimal,
    totalPool: Prisma.Decimal,
    feeBps: number
  ): PayoutResult;

  /**
   * Get the engine type identifier
   */
  getType(): string;
}

// ============================================================================
// CONSTANT PRODUCT AMM (CPMM)
// ============================================================================

/**
 * Constant Product AMM Implementation
 * 
 * CPMM for Prediction Markets (per Gnosis Conditional Tokens):
 * - Maintains invariant: reserve0 * reserve1 = k
 * - Buying: Mint complete sets, return shares of desired outcome
 * - Selling: Add shares, burn complete sets to restore invariant
 * - Price formula: price0 = reserve1 / (reserve0 + reserve1)
 * - Each winning share = $1 at settlement
 * 
 * UNITS:
 * - Reserves: SHARES (e.g., Decimal("1060") = 1060 shares of liquidity)
 * - Costs: DOLLARS (Decimal("10.00") = $10 = 10 complete sets)
 * - Returns: Shares (dimensionless, each worth $1 if outcome wins)
 * - Proceeds: DOLLARS (Decimal values)
 * 
 * Buy Formula: To buy outcome 0 with $X:
 *   1. Convert $X to X complete sets (X shares of each outcome)
 *   2. Add complete sets to reserves: [r0+X, r1+X]
 *   3. Return shares of outcome 0 to restore k: shares = (r0+X) - k/(r1+X)
 * 
 * Example from Gnosis docs:
 *   Initial: [10, 10], k=100, price=50%
 *   Buy $10 of outcome 0:
 *     - Add 10 complete sets: [20, 20]
 *     - Return 15 shares: final [5, 20]
 *     - New price = 20/(5+20) = 80%
 * 
 * This mirrors on-chain AMM behavior for easy migration.
 */
export class ConstantProductAMM implements PricingEngine {
  getType(): string {
    return "cpmm";
  }

  /**
   * Calculate current prices from reserves
   * 
   * In CPMM for prediction markets:
   * - price0 = reserve1 / (reserve0 + reserve1)
   * - price1 = reserve0 / (reserve0 + reserve1)
   * 
   * Higher reserve means lower price (more supply = cheaper)
   */
  calculatePrice(reserve0: Prisma.Decimal, reserve1: Prisma.Decimal): PriceResult {
    const total = currency.add(reserve0, reserve1);
    
    if (currency.isZero(total)) {
      return { 
        price0: currency.decimal("0.5"), 
        price1: currency.decimal("0.5") 
      };
    }

    // Price of outcome X is proportional to the OTHER reserve
    // Because when you buy X, you're "exchanging" the other outcome
    return {
      price0: currency.divide(reserve1, total),
      price1: currency.divide(reserve0, total),
    };
  }

  /**
   * Calculate payout for shares in CPMM
   * 
   * In AMM: 1 winning share = $1 (after fees)
   */
  calculatePayout(
    shares: Prisma.Decimal,
    _winningPool: Prisma.Decimal,
    _totalPool: Prisma.Decimal,
    feeBps: number
  ): PayoutResult {
    // In CPMM, each winning share is worth $1
    const grossPayout = shares;
    const fee = currency.calculateFee(grossPayout, feeBps);
    const netPayout = currency.subtract(grossPayout, fee);

    return { 
      payout: currency.floor(netPayout), 
      netPool: grossPayout, 
      fee 
    };
  }

  /**
   * Calculate cost to buy a specific number of shares
   * 
   * When buying shares of outcome 0:
   * - Remove shares from reserve0 (shares become yours)
   * - Calculate new reserve1 to maintain k = reserve0 * reserve1
   * - Cost = newReserve1 - oldReserve1
   * 
   * @param shares Number of shares to buy
   * @param reserve The reserve of the outcome being purchased
   * @param otherReserve The reserve of the other outcome
   * @param k The invariant (reserve0 * reserve1)
   */
  getBuyCost(
    shares: Prisma.Decimal,
    reserve: Prisma.Decimal,
    otherReserve: Prisma.Decimal,
    k: Prisma.Decimal
  ): BuyCostResult {
    if (currency.isLessThanOrEqual(shares, 0)) {
      throw new Error("Shares must be positive");
    }

    const newReserve = currency.subtract(reserve, shares);
    
    if (currency.isLessThanOrEqual(newReserve, 0)) {
      throw new Error("Insufficient liquidity: cannot buy more shares than available");
    }

    const newOtherReserve = currency.divide(k, newReserve);
    const cost = currency.subtract(newOtherReserve, otherReserve);
    const avgPrice = currency.divide(cost, shares);

    // Calculate price impact
    const oldPrice = currency.divide(otherReserve, currency.add(reserve, otherReserve));
    const newPrice = currency.divide(newOtherReserve, currency.add(newReserve, newOtherReserve));
    const priceImpact = currency.abs(currency.divide(currency.subtract(newPrice, oldPrice), oldPrice));

    return { 
      cost, 
      avgPrice, 
      shares,
      newReserve, 
      newOtherReserve,
      priceImpact
    };
  }

  /**
   * Calculate shares received for a given cost
   * 
   * CPMM Formula for Prediction Markets (per Gnosis):
   * 1. Convert cost to complete sets (cost in dollars = that many complete sets)
   * 2. Add complete sets to BOTH reserves (breaks invariant)
   * 3. Return enough shares of desired outcome to restore invariant
   * 
   * Example: Buy $10 of outcome 0 with reserves [10, 10]:
   *   - Add 10 to both: reserves become [20, 20], k should be 100 but is 400
   *   - Return X shares of outcome 0 where (20-X) * 20 = 100
   *   - X = 15, so user gets 15 shares for $10
   * 
   * @param cost Dollar amount to spend IN DOLLARS
   * @param reserve The reserve of the outcome being purchased (in SHARES)
   * @param otherReserve The reserve of the other outcome (in SHARES)
   * @param k The invariant
   */
  getSharesForCost(
    cost: Prisma.Decimal,
    reserve: Prisma.Decimal,
    otherReserve: Prisma.Decimal,
    k: Prisma.Decimal
  ): SharesForCostResult {
    if (currency.isLessThanOrEqual(cost, 0)) {
      throw new Error("Cost must be positive");
    }

    // Complete sets equal the dollar cost
    const completeSets = cost;
    
    // Step 2: Add complete sets to inventory (breaks invariant)
    const reserveWithSets = currency.add(reserve, completeSets);
    const otherReserveWithSets = currency.add(otherReserve, completeSets);
    
    // Step 3: Return shares of desired outcome to restore invariant
    // We need: (reserveWithSets - shares) * otherReserveWithSets = k
    // So: shares = reserveWithSets - (k / otherReserveWithSets)
    const newReserve = currency.divide(k, otherReserveWithSets);
    const shares = currency.subtract(reserveWithSets, newReserve);
    const newOtherReserve = otherReserveWithSets;

    if (currency.isLessThanOrEqual(shares, 0)) {
      throw new Error("Cost too low to purchase any shares");
    }

    const avgPrice = currency.divide(cost, shares);

    // Calculate price impact
    const oldPrice = currency.divide(otherReserve, currency.add(reserve, otherReserve));
    const newPrice = currency.divide(newOtherReserve, currency.add(newReserve, newOtherReserve));
    const priceImpact = currency.abs(currency.divide(currency.subtract(newPrice, oldPrice), oldPrice));

    return { 
      shares, 
      avgPrice, 
      cost,
      newReserve, 
      newOtherReserve,
      priceImpact
    };
  }

  /**
   * Calculate proceeds from selling shares
   * 
   * CPMM Sell Formula (per Gnosis):
   * 1. Add sold shares to reserve (breaks invariant)
   * 2. Burn enough complete sets to restore invariant
   * 3. Return the value of burned complete sets as proceeds
   * 
   * @param shares Number of shares to sell
   * @param reserve The reserve of the outcome being sold (in SHARES)
   * @param otherReserve The reserve of the other outcome (in SHARES)
   * @param k The invariant
   */
  getSellProceeds(
    shares: Prisma.Decimal,
    reserve: Prisma.Decimal,
    otherReserve: Prisma.Decimal,
    k: Prisma.Decimal
  ): SellResult {
    if (currency.isLessThanOrEqual(shares, 0)) {
      throw new Error("Shares must be positive");
    }

    // Step 1: Add sold shares to inventory (breaks invariant)
    const reserveWithShares = currency.add(reserve, shares);
    
    // Step 2: Burn complete sets to restore invariant
    // We need: (reserveWithShares - completeSets) * (otherReserve - completeSets) = k
    // This is a quadratic, but we can solve it iteratively or use the formula:
    // Let x = completeSets, then: (r0+shares-x)(r1-x) = k
    // Expanding: r0*r1 + shares*r1 - r0*x - shares*x - r1*x + x^2 = k
    // x^2 - x*(r0 + r1 + shares) + (r0*r1 + shares*r1 - k) = 0
    
    const a = currency.decimal("1");
    const b = currency.multiply(
      currency.decimal("-1"),
      currency.add(currency.add(reserveWithShares, otherReserve), currency.zero())
    );
    const c = currency.subtract(
      currency.multiply(reserveWithShares, otherReserve),
      k
    );
    
    // discriminant = b^2 - 4ac
    const discriminant = currency.subtract(
      currency.multiply(b, b),
      currency.multiply(currency.multiply(currency.decimal("4"), a), c)
    );
    
    if (currency.isNegative(discriminant)) {
      throw new Error("Cannot sell: would break invariant");
    }
    
    // Take the smaller root (we want to burn the minimum to restore invariant)
    // completeSets = (-b - sqrt(discriminant)) / 2a
    const sqrtDiscriminant = currency.decimal(Math.sqrt(currency.toNumber(discriminant)));
    const numerator = currency.subtract(
      currency.multiply(currency.decimal("-1"), b),
      sqrtDiscriminant
    );
    const completeSets = currency.divide(numerator, currency.multiply(currency.decimal("2"), a));
    
    const newReserve = currency.subtract(reserveWithShares, completeSets);
    const newOtherReserve = currency.subtract(otherReserve, completeSets);
    
    // Step 3: Proceeds = value of complete sets burned (in dollars)
    const proceeds = currency.floor(completeSets);
    const avgPrice = currency.divide(proceeds, shares);

    // Calculate price impact
    const oldPrice = currency.divide(otherReserve, currency.add(reserve, otherReserve));
    const newPrice = currency.divide(newOtherReserve, currency.add(newReserve, newOtherReserve));
    const priceImpact = currency.abs(currency.divide(currency.subtract(newPrice, oldPrice), oldPrice));

    return { 
      proceeds, 
      avgPrice,
      shares,
      newReserve, 
      newOtherReserve,
      priceImpact
    };
  }

  /**
   * Get a quote for a trade without executing it
   */
  getQuote(params: {
    side: "buy" | "sell";
    outcomeIndex: 0 | 1;
    amount: Prisma.Decimal; // Cost for buy, shares for sell
    reserve0: Prisma.Decimal;
    reserve1: Prisma.Decimal;
    k: Prisma.Decimal;
    feeBps: number;
  }): QuoteResult {
    const { side, outcomeIndex, amount, reserve0, reserve1, k, feeBps } = params;

    const reserve = outcomeIndex === 0 ? reserve0 : reserve1;
    const otherReserve = outcomeIndex === 0 ? reserve1 : reserve0;

    let inputAmount: Prisma.Decimal;
    let outputAmount: Prisma.Decimal;
    let avgPrice: Prisma.Decimal;
    let priceImpact: Prisma.Decimal;
    let newReserve: Prisma.Decimal;
    let newOtherReserve: Prisma.Decimal;
    let feeAmount = currency.zero();

    if (side === "buy") {
      // Apply fee to input (cost)
      feeAmount = currency.calculateFee(amount, feeBps);
      const costAfterFee = currency.subtract(amount, feeAmount);

      const result = this.getSharesForCost(costAfterFee, reserve, otherReserve, k);
      inputAmount = amount;
      outputAmount = result.shares;
      avgPrice = result.avgPrice;
      priceImpact = result.priceImpact;
      newReserve = result.newReserve;
      newOtherReserve = result.newOtherReserve;
    } else {
      const result = this.getSellProceeds(amount, reserve, otherReserve, k);
      
      // Apply fee to output (proceeds)
      feeAmount = currency.calculateFee(result.proceeds, feeBps);
      
      inputAmount = amount;
      outputAmount = currency.subtract(result.proceeds, feeAmount);
      avgPrice = result.avgPrice;
      priceImpact = result.priceImpact;
      newReserve = result.newReserve;
      newOtherReserve = result.newOtherReserve;
    }

    // Calculate new prices after trade
    const finalReserve0 = outcomeIndex === 0 ? newReserve : newOtherReserve;
    const finalReserve1 = outcomeIndex === 0 ? newOtherReserve : newReserve;
    const newPrices = this.calculatePrice(finalReserve0, finalReserve1);

    return {
      side,
      outcomeIndex,
      inputAmount,
      outputAmount,
      avgPrice,
      priceImpact,
      newPrices,
      feeBps,
      feeAmount,
    };
  }

  /**
   * Calculate the initial k value for market creation
   */
  static calculateInitialK(reserve0: Prisma.Decimal, reserve1: Prisma.Decimal): Prisma.Decimal {
    return currency.multiply(reserve0, reserve1);
  }
}

// ============================================================================
// FACTORY & HELPERS
// ============================================================================

/**
 * Get the default pricing engine (CPMM)
 */
export function getDefaultPricingEngine(): PricingEngine {
  return new ConstantProductAMM();
}

/**
 * Get the CPMM pricing engine for shares-based trading
 */
export function getCPMMEngine(): ConstantProductAMM {
  return new ConstantProductAMM();
}

/**
 * Get pricing engine (always returns CPMM)
 */
export function getPricingEngine(): PricingEngine {
  return new ConstantProductAMM();
}

/**
 * Singleton instance for convenience
 */
export const cpmmEngine = new ConstantProductAMM();

// Default export
export const pricingEngine = cpmmEngine;
