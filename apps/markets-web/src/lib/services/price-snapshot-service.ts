import { prisma, type Prisma } from "@vault/database";
import { pricingEngine } from "./pricing-engine";

/**
 * Price Snapshot Service
 * 
 * Records price snapshots for markets to enable historical price charts.
 * Snapshots are created when pools change (bet confirmation).
 */

// Minimum interval between snapshots (in milliseconds)
const MIN_SNAPSHOT_INTERVAL_MS = 60 * 1000; // 1 minute

export interface PriceSnapshotData {
  marketId: string;
  price0: number;
  price1: number;
  pool0: number;
  pool1: number;
  timestamp: Date;
}

/**
 * Create a price snapshot for a market
 * This should be called after pool values change (e.g., bet confirmation)
 */
export async function createPriceSnapshot(
  tx: Prisma.TransactionClient,
  marketId: string,
  pool0: number | Prisma.Decimal,
  pool1: number | Prisma.Decimal,
  seed0: number | Prisma.Decimal,
  seed1: number | Prisma.Decimal
): Promise<void> {
  // Convert Decimals to numbers if needed
  const pool0Num = typeof pool0 === 'number' ? pool0 : Number(pool0);
  const pool1Num = typeof pool1 === 'number' ? pool1 : Number(pool1);
  const seed0Num = typeof seed0 === 'number' ? seed0 : Number(seed0);
  const seed1Num = typeof seed1 === 'number' ? seed1 : Number(seed1);

  // Calculate total pools including seeds
  const totalPool0 = seed0Num + pool0Num;
  const totalPool1 = seed1Num + pool1Num;

  // Calculate prices
  const { price0, price1 } = pricingEngine.calculatePrice(totalPool0, totalPool1);

  // Check if we should create a snapshot (rate limiting)
  const lastSnapshot = await tx.priceSnapshot.findFirst({
    where: { marketId },
    orderBy: { timestamp: "desc" },
  });

  if (lastSnapshot) {
    const timeSinceLastSnapshot = Date.now() - lastSnapshot.timestamp.getTime();
    if (timeSinceLastSnapshot < MIN_SNAPSHOT_INTERVAL_MS) {
      // Too soon, update the last snapshot instead
      await tx.priceSnapshot.update({
        where: { id: lastSnapshot.id },
        data: {
          price0,
          price1,
          pool0: totalPool0,
          pool1: totalPool1,
          timestamp: new Date(),
        },
      });
      return;
    }
  }

  // Create new snapshot
  await tx.priceSnapshot.create({
    data: {
      marketId,
      price0,
      price1,
      pool0: totalPool0,
      pool1: totalPool1,
    },
  });
}

/**
 * Create initial snapshot when market is published
 */
export async function createInitialSnapshot(
  marketId: string,
  seed0: number,
  seed1: number
): Promise<void> {
  const { price0, price1 } = pricingEngine.calculatePrice(seed0, seed1);

  await prisma.priceSnapshot.create({
    data: {
      marketId,
      price0,
      price1,
      pool0: seed0,
      pool1: seed1,
    },
  });
}

export type TimePeriod = "1H" | "6H" | "1D" | "1W" | "1M" | "ALL";

/**
 * Get price history for a market
 */
export async function getPriceHistory(
  marketId: string,
  period: TimePeriod = "1D"
): Promise<PriceSnapshotData[]> {
  const now = new Date();
  let startTime: Date;

  switch (period) {
    case "1H":
      startTime = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case "6H":
      startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
      break;
    case "1D":
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "1W":
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "1M":
      startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "ALL":
      startTime = new Date(0); // Beginning of time
      break;
  }

  const snapshots = await prisma.priceSnapshot.findMany({
    where: {
      marketId,
      timestamp: { gte: startTime },
    },
    orderBy: { timestamp: "asc" },
    take: 500, // Limit to 500 data points
  });

  return snapshots.map((s) => ({
    marketId: s.marketId,
    price0: Number(s.price0),
    price1: Number(s.price1),
    pool0: Number(s.pool0),
    pool1: Number(s.pool1),
    timestamp: s.timestamp,
  }));
}

/**
 * Get the latest price snapshot for a market
 */
export async function getLatestSnapshot(
  marketId: string
): Promise<PriceSnapshotData | null> {
  const snapshot = await prisma.priceSnapshot.findFirst({
    where: { marketId },
    orderBy: { timestamp: "desc" },
  });

  if (!snapshot) return null;

  return {
    marketId: snapshot.marketId,
    price0: Number(snapshot.price0),
    price1: Number(snapshot.price1),
    pool0: Number(snapshot.pool0),
    pool1: Number(snapshot.pool1),
    timestamp: snapshot.timestamp,
  };
}
