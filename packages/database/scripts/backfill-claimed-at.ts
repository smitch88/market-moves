/**
 * Backfill Migration: Set claimedAt for existing settled positions
 * 
 * This script handles the migration from automatic payouts to manual redemption.
 * For positions on markets that were settled before this migration, we set
 * claimedAt to the market's settledAt timestamp (since payouts were automatic).
 * 
 * Usage: npx tsx scripts/backfill-claimed-at.ts
 */

import { PrismaClient } from "../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Backfilling claimedAt for existing settled positions...\n");

  // Find all positions on settled markets that don't have claimedAt set
  const positionsToUpdate = await prisma.position.findMany({
    where: {
      claimedAt: null,
      market: {
        settledAt: { not: null },
      },
    },
    include: {
      market: {
        select: {
          id: true,
          question: true,
          settledAt: true,
        },
      },
      user: {
        select: {
          handle: true,
          email: true,
        },
      },
    },
  });

  if (positionsToUpdate.length === 0) {
    console.log("✅ No positions need to be backfilled.");
    return;
  }

  console.log(`📋 Found ${positionsToUpdate.length} positions to backfill:\n`);

  // Group by market for better logging
  const byMarket = new Map<string, typeof positionsToUpdate>();
  for (const position of positionsToUpdate) {
    const marketId = position.market.id;
    const existing = byMarket.get(marketId) || [];
    existing.push(position);
    byMarket.set(marketId, existing);
  }

  for (const [marketId, positions] of byMarket) {
    const market = positions[0].market;
    console.log(`  📊 ${market.question.substring(0, 50)}...`);
    console.log(`     Market ID: ${marketId}`);
    console.log(`     Settled at: ${market.settledAt?.toISOString()}`);
    console.log(`     Positions: ${positions.length}`);
    
    for (const pos of positions) {
      const userDisplay = pos.user.handle || pos.user.email || "Unknown";
      console.log(`       - User: ${userDisplay}`);
    }
    console.log("");
  }

  // Confirm before proceeding
  console.log("⚠️  This will set claimedAt = settledAt for all these positions.");
  console.log("   This marks them as already claimed (they received automatic payouts).\n");

  // Perform the update
  let updated = 0;
  for (const position of positionsToUpdate) {
    await prisma.position.update({
      where: { id: position.id },
      data: { claimedAt: position.market.settledAt },
    });
    updated++;
  }

  console.log(`\n✅ Successfully backfilled ${updated} positions.`);
}

main()
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
