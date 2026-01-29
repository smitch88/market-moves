import { EventEmitter } from "events";

/**
 * Price Broadcaster Service
 * 
 * In-memory event emitter for broadcasting real-time price updates.
 * Used by SSE endpoint to push updates to connected clients.
 * 
 * Supports both pari-mutuel (pools) and CPMM (reserves) pricing models.
 */

export interface PriceUpdateEvent {
  type: "price_update";
  marketId: string;
  eventId: string;
  prices: [number, number];
  pools: [number, number]; // For pari-mutuel or combined totals
  reserves?: [number, number]; // For CPMM markets
  k?: number; // CPMM invariant
  pricingModel?: "PARI_MUTUEL" | "CPMM";
  timestamp: string;
}

// Event types for type safety
type PriceBroadcasterEvents = {
  priceUpdate: [PriceUpdateEvent];
};

class PriceBroadcaster {
  private emitter: EventEmitter;
  private static instance: PriceBroadcaster;

  private constructor() {
    this.emitter = new EventEmitter();
    // Increase max listeners for high-traffic scenarios
    this.emitter.setMaxListeners(1000);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PriceBroadcaster {
    if (!PriceBroadcaster.instance) {
      PriceBroadcaster.instance = new PriceBroadcaster();
    }
    return PriceBroadcaster.instance;
  }

  /**
   * Broadcast a price change to all connected clients
   */
  broadcastPriceChange(
    marketId: string,
    eventId: string,
    prices: [number, number],
    pools: [number, number],
    options?: {
      reserves?: [number, number];
      k?: number;
      pricingModel?: "PARI_MUTUEL" | "CPMM";
    }
  ): void {
    const event: PriceUpdateEvent = {
      type: "price_update",
      marketId,
      eventId,
      prices,
      pools,
      reserves: options?.reserves,
      k: options?.k,
      pricingModel: options?.pricingModel,
      timestamp: new Date().toISOString(),
    };

    this.emitter.emit("priceUpdate", event);
  }

  /**
   * Subscribe to price updates
   * @returns Unsubscribe function
   */
  subscribe(callback: (event: PriceUpdateEvent) => void): () => void {
    this.emitter.on("priceUpdate", callback);
    return () => {
      this.emitter.off("priceUpdate", callback);
    };
  }

  /**
   * Get the number of active listeners (for debugging)
   */
  getListenerCount(): number {
    return this.emitter.listenerCount("priceUpdate");
  }
}

// Export singleton instance
export const priceBroadcaster = PriceBroadcaster.getInstance();

// Export convenience function
export function broadcastPriceChange(
  marketId: string,
  eventId: string,
  prices: [number, number],
  pools: [number, number],
  options?: {
    reserves?: [number, number];
    k?: number;
    pricingModel?: "PARI_MUTUEL" | "CPMM";
  }
): void {
  priceBroadcaster.broadcastPriceChange(marketId, eventId, prices, pools, options);
}
