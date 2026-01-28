/**
 * Pricing Engine Interface
 * 
 * This abstraction allows swapping between different pricing mechanisms:
 * - PariMutuelPricing (current implementation)
 * - ConstantProductPricing (future AMM)
 * - OnChainAMMPricing (future on-chain integration)
 */

export interface PriceResult {
  price0: number; // Probability of outcome 0 (0-1)
  price1: number; // Probability of outcome 1 (0-1)
}

export interface PayoutResult {
  payout: number;
  netPool: number;
  fee: number;
}

export interface PricingEngine {
  /**
   * Calculate current prices for both outcomes
   */
  calculatePrice(pool0: number, pool1: number): PriceResult;

  /**
   * Calculate payout for a winning bet
   */
  calculatePayout(
    stake: number,
    winningPool: number,
    totalPool: number,
    feeBps: number
  ): PayoutResult;

  /**
   * Get the engine type identifier
   */
  getType(): string;
}

/**
 * Pari-Mutuel Pricing Implementation
 * 
 * Classic pari-mutuel betting where:
 * - All bets are pooled together
 * - Odds are determined by pool distribution
 * - Winners share the net pool proportionally
 * - Fee is deducted at settlement
 */
export class PariMutuelPricing implements PricingEngine {
  getType(): string {
    return "pari-mutuel";
  }

  calculatePrice(pool0: number, pool1: number): PriceResult {
    const total = pool0 + pool1;
    
    if (total === 0) {
      return { price0: 0.5, price1: 0.5 };
    }

    return {
      price0: pool0 / total,
      price1: pool1 / total,
    };
  }

  calculatePayout(
    stake: number,
    winningPool: number,
    totalPool: number,
    feeBps: number
  ): PayoutResult {
    if (winningPool === 0) {
      return { payout: 0, netPool: 0, fee: 0 };
    }

    const feeRate = feeBps / 10000;
    const fee = totalPool * feeRate;
    const netPool = totalPool - fee;
    const payout = Math.floor((stake / winningPool) * netPool);

    return { payout, netPool, fee };
  }
}

/**
 * Constant Product AMM Pricing (for future use)
 * 
 * x * y = k pricing model used by Uniswap-style AMMs
 * Note: This is a placeholder for future implementation
 */
export class ConstantProductPricing implements PricingEngine {
  getType(): string {
    return "constant-product-amm";
  }

  calculatePrice(pool0: number, pool1: number): PriceResult {
    const total = pool0 + pool1;
    
    if (total === 0) {
      return { price0: 0.5, price1: 0.5 };
    }

    // In constant product AMM, price is determined by reserve ratios
    // price0 = reserve1 / reserve0 (marginal price)
    // For binary outcomes, we normalize to probabilities
    return {
      price0: pool0 / total,
      price1: pool1 / total,
    };
  }

  calculatePayout(
    stake: number,
    winningPool: number,
    totalPool: number,
    feeBps: number
  ): PayoutResult {
    // In AMM, payout is different - you get shares that can be redeemed
    // For now, use same logic as pari-mutuel
    if (winningPool === 0) {
      return { payout: 0, netPool: 0, fee: 0 };
    }

    const feeRate = feeBps / 10000;
    const fee = totalPool * feeRate;
    const netPool = totalPool - fee;
    const payout = Math.floor((stake / winningPool) * netPool);

    return { payout, netPool, fee };
  }
}

/**
 * Get the default pricing engine
 */
export function getDefaultPricingEngine(): PricingEngine {
  return new PariMutuelPricing();
}

/**
 * Singleton instance for convenience
 */
export const pricingEngine = getDefaultPricingEngine();
