/**
 * Post-Migration Verification Script
 * 
 * Run this script after applying the event_market_restructure migration
 * to verify data integrity and fix any issues.
 * 
 * Usage: pnpm --filter @vault/database migrate:verify
 */

import { resolve } from "path";
import { config } from "dotenv";

// Load .env from the database package root
config({ path: resolve(__dirname, "../.env") });

import { PrismaClient } from "../src/generated/client";

const prisma = new PrismaClient();

async function verifyMigration() {
  console.log("Starting post-migration verification...\n");

  let hasErrors = false;

  // 1. Verify all Markets have a valid Event
  console.log("1. Checking Market -> Event relationships...");
  const marketsWithEvents = await prisma.market.findMany({
    select: { id: true, eventId: true, event: { select: { id: true } } },
  });
  const orphanedMarkets = marketsWithEvents.filter((m) => !m.event);
  if (orphanedMarkets.length > 0) {
    console.error(`   ERROR: ${orphanedMarkets.length} markets without valid event`);
    hasErrors = true;
  } else {
    console.log(`   OK: All ${marketsWithEvents.length} markets have a valid event`);
  }

  // 2. Verify all Events have at least one Market
  console.log("\n2. Checking Event -> Market relationships...");
  const eventsWithoutMarkets = await prisma.event.findMany({
    where: {
      markets: { none: {} },
    },
    select: { id: true, slug: true },
  });
  if (eventsWithoutMarkets.length > 0) {
    console.warn(`   WARNING: ${eventsWithoutMarkets.length} events without markets:`);
    eventsWithoutMarkets.forEach((e) => console.warn(`     - ${e.slug}`));
  } else {
    console.log("   OK: All events have at least one market");
  }

  // 3. Verify Bet outcomeIndex values
  console.log("\n3. Checking Bet outcomeIndex values...");
  const invalidBetOutcomes = await prisma.bet.count({
    where: {
      OR: [
        { outcomeIndex: { lt: 0 } },
        { outcomeIndex: { gt: 1 } },
      ],
    },
  });
  if (invalidBetOutcomes > 0) {
    console.error(`   ERROR: ${invalidBetOutcomes} bets with invalid outcomeIndex`);
    hasErrors = true;
  } else {
    console.log("   OK: All bet outcomeIndex values are 0 or 1");
  }

  // 4. Verify Market outcomes JSON is valid
  console.log("\n4. Checking Market outcomes JSON...");
  const markets = await prisma.market.findMany({
    select: { id: true, question: true, outcomes: true },
  });
  let invalidOutcomes = 0;
  for (const market of markets) {
    try {
      const parsed = JSON.parse(market.outcomes);
      if (!Array.isArray(parsed) || parsed.length !== 2) {
        console.error(`   ERROR: Market ${market.id} has invalid outcomes array: ${market.outcomes}`);
        invalidOutcomes++;
      }
    } catch {
      console.error(`   ERROR: Market ${market.id} has invalid JSON: ${market.outcomes}`);
      invalidOutcomes++;
    }
  }
  if (invalidOutcomes > 0) {
    hasErrors = true;
  } else {
    console.log(`   OK: All ${markets.length} markets have valid outcomes JSON`);
  }

  // 5. Verify pool totals match confirmed bets
  console.log("\n5. Verifying pool totals...");
  const marketsWithBets = await prisma.market.findMany({
    select: {
      id: true,
      question: true,
      pool0: true,
      pool1: true,
      bets: {
        where: { status: "CONFIRMED" },
        select: { amount: true, outcomeIndex: true },
      },
    },
  });

  let poolMismatches = 0;
  for (const market of marketsWithBets) {
    const calcPool0 = market.bets
      .filter((b) => b.outcomeIndex === 0)
      .reduce((sum, b) => sum + b.amount, 0);
    const calcPool1 = market.bets
      .filter((b) => b.outcomeIndex === 1)
      .reduce((sum, b) => sum + b.amount, 0);

    if (market.pool0 !== calcPool0 || market.pool1 !== calcPool1) {
      console.warn(`   WARNING: Pool mismatch for market "${market.question}":`);
      console.warn(`     pool0: stored=${market.pool0}, calculated=${calcPool0}`);
      console.warn(`     pool1: stored=${market.pool1}, calculated=${calcPool1}`);
      poolMismatches++;
    }
  }
  if (poolMismatches > 0) {
    console.warn(`   ${poolMismatches} markets have pool mismatches (may need recalculation)`);
  } else {
    console.log(`   OK: All pool totals are correct`);
  }

  // 6. Verify Position amounts
  console.log("\n6. Checking Position amount columns...");
  const positions = await prisma.position.findMany({
    select: { id: true, amount0: true, amount1: true },
  });
  const invalidPositions = positions.filter(
    (p) => p.amount0 < 0 || p.amount1 < 0
  );
  if (invalidPositions.length > 0) {
    console.error(`   ERROR: ${invalidPositions.length} positions with negative amounts`);
    hasErrors = true;
  } else {
    console.log(`   OK: All ${positions.length} positions have valid amounts`);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  if (hasErrors) {
    console.error("VERIFICATION FAILED: Please fix the errors above");
    process.exit(1);
  } else {
    console.log("VERIFICATION PASSED: Migration completed successfully!");
  }
}

async function recalculatePools() {
  console.log("Recalculating pool totals from confirmed bets...\n");

  const markets = await prisma.market.findMany({
    select: { id: true, question: true },
  });

  for (const market of markets) {
    const bets = await prisma.bet.findMany({
      where: { marketId: market.id, status: "CONFIRMED" },
      select: { amount: true, outcomeIndex: true },
    });

    const pool0 = bets
      .filter((b) => b.outcomeIndex === 0)
      .reduce((sum, b) => sum + b.amount, 0);
    const pool1 = bets
      .filter((b) => b.outcomeIndex === 1)
      .reduce((sum, b) => sum + b.amount, 0);

    await prisma.market.update({
      where: { id: market.id },
      data: { pool0, pool1 },
    });

    console.log(`  ${market.question}: pool0=${pool0}, pool1=${pool1}`);
  }

  console.log("\nPool recalculation complete!");
}

async function main() {
  const command = process.argv[2];

  try {
    if (command === "recalculate-pools") {
      await recalculatePools();
    } else {
      await verifyMigration();
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
