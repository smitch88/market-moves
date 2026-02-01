/**
 * Migration script to:
 * 1. Delete users without Twitter identity (no twitterSubject or handle)
 * 2. Set referralCode equal to handle for all remaining users
 * 
 * Usage: pnpm --filter @vault/database db:migrate:referral-codes
 *    or: pnpm --filter @vault/database db:migrate:referral-codes --dry-run
 */

import { resolve } from "path";
import { config } from "dotenv";

// Load .env
config({ path: resolve(__dirname, "../.env") });

import { PrismaClient } from "../src/generated/client";

const prisma = new PrismaClient();

// Parse command line args
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

async function main() {
  console.log("Starting referral code migration...\n");
  
  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Step 1: Find users without Twitter identity
  const usersWithoutTwitter = await prisma.user.findMany({
    where: {
      OR: [
        { twitterSubject: null },
        { handle: null },
      ],
    },
    select: {
      id: true,
      email: true,
      handle: true,
      twitterSubject: true,
      createdAt: true,
    },
  });

  console.log(`Found ${usersWithoutTwitter.length} users without Twitter identity:\n`);
  
  for (const user of usersWithoutTwitter) {
    console.log(`  - ID: ${user.id}`);
    console.log(`    Email: ${user.email || "N/A"}`);
    console.log(`    Handle: ${user.handle || "N/A"}`);
    console.log(`    Twitter Subject: ${user.twitterSubject || "N/A"}`);
    console.log(`    Created: ${user.createdAt.toISOString()}\n`);
  }

  if (usersWithoutTwitter.length > 0) {
    if (dryRun) {
      console.log("Would delete users without Twitter identity and their related records...\n");
      console.log(`  Would delete ${usersWithoutTwitter.length} users\n`);
    } else {
      console.log("Deleting users without Twitter identity and their related records...\n");

      const userIds = usersWithoutTwitter.map((u) => u.id);

      // Delete in correct order to handle foreign key constraints
      // (Records that don't have cascade delete on the User relation)
      
      // Delete referrals where they are the referrer
      const deletedReferralsGiven = await prisma.referral.deleteMany({
        where: { referrerUserId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedReferralsGiven.count} referrals given`);

      // Delete referrals where they are the referred
      const deletedReferralsReceived = await prisma.referral.deleteMany({
        where: { referredUserId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedReferralsReceived.count} referrals received`);

      // Delete balance ledger entries
      const deletedBalanceLedger = await prisma.balanceLedger.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedBalanceLedger.count} balance ledger entries`);

      // Delete PnL ledger entries
      const deletedPnLLedger = await prisma.pnLLedger.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedPnLLedger.count} PnL ledger entries`);

      // Delete XP ledger entries
      const deletedXPLedger = await prisma.xPLedger.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedXPLedger.count} XP ledger entries`);

      // Delete user PnL snapshots
      const deletedPnLSnapshots = await prisma.userPnLSnapshot.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedPnLSnapshots.count} PnL snapshots`);

      // Delete positions
      const deletedPositions = await prisma.position.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedPositions.count} positions`);

      // Delete bets
      const deletedBets = await prisma.bet.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedBets.count} bets`);

      // Delete tweet proofs
      const deletedTweetProofs = await prisma.tweetProof.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedTweetProofs.count} tweet proofs`);

      // Delete raffle entries
      const deletedRaffleEntries = await prisma.raffleEntry.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedRaffleEntries.count} raffle entries`);

      // Delete market requests
      const deletedMarketRequests = await prisma.marketRequest.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedMarketRequests.count} market requests`);

      // Delete bookmarks
      const deletedBookmarks = await prisma.bookmark.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedBookmarks.count} bookmarks`);

      // Delete XP trade trackers (has cascade)
      const deletedXPTradeTrackers = await prisma.xPTradeTracker.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedXPTradeTrackers.count} XP trade trackers`);

      // Delete XP daily totals (has cascade)
      const deletedXPDailyTotals = await prisma.xPDailyTotal.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedXPDailyTotals.count} XP daily totals`);

      // Delete streak badges (has cascade)
      const deletedStreakBadges = await prisma.streakBadge.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedStreakBadges.count} streak badges`);

      // Delete admin action logs
      const deletedAdminLogs = await prisma.adminActionLog.deleteMany({
        where: { userId: { in: userIds } },
      });
      console.log(`  Deleted ${deletedAdminLogs.count} admin action logs`);

      // Clear actorAdminUserId references in balance ledger (for adjustments made by these users)
      const clearedBalanceAdminRefs = await prisma.balanceLedger.updateMany({
        where: { actorAdminUserId: { in: userIds } },
        data: { actorAdminUserId: null },
      });
      console.log(`  Cleared ${clearedBalanceAdminRefs.count} balance ledger admin references`);

      // Clear adminUserId references in XP ledger (for adjustments made by these users)
      const clearedXPAdminRefs = await prisma.xPLedger.updateMany({
        where: { adminUserId: { in: userIds } },
        data: { adminUserId: null },
      });
      console.log(`  Cleared ${clearedXPAdminRefs.count} XP ledger admin references`);

      // Clear captain references (set captainId to null for followers of these users)
      const clearedCaptains = await prisma.user.updateMany({
        where: { captainId: { in: userIds } },
        data: { captainId: null },
      });
      console.log(`  Cleared ${clearedCaptains.count} captain references`);

      // Clear market request reviewer references
      const clearedReviewerRefs = await prisma.marketRequest.updateMany({
        where: { reviewedByUserId: { in: userIds } },
        data: { reviewedByUserId: null },
      });
      console.log(`  Cleared ${clearedReviewerRefs.count} market request reviewer references`);

      // Finally, delete the users
      const deletedUsers = await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
      console.log(`\n  Deleted ${deletedUsers.count} users without Twitter identity`);
    }
  }

  // Step 2: Update referralCode to match handle for remaining users
  console.log("\n\nUpdating referral codes to match handles...\n");

  const usersToUpdate = await prisma.user.findMany({
    where: {
      handle: { not: null },
    },
    select: {
      id: true,
      handle: true,
      referralCode: true,
    },
  });

  let updatedCount = 0;
  let skippedCount = 0;
  let wouldUpdateCount = 0;
  const errors: string[] = [];

  for (const user of usersToUpdate) {
    if (!user.handle) {
      skippedCount++;
      continue;
    }

    // Skip if already matching
    if (user.referralCode === user.handle) {
      skippedCount++;
      continue;
    }

    if (dryRun) {
      console.log(`  Would update: ${user.handle} (currently: ${user.referralCode})`);
      wouldUpdateCount++;
    } else {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { referralCode: user.handle },
        });
        console.log(`  Updated: ${user.handle} (was: ${user.referralCode})`);
        updatedCount++;
      } catch (error) {
        // Handle unique constraint violation (another user already has this referral code)
        const errorMessage = `  Error updating ${user.handle}: ${error instanceof Error ? error.message : "Unknown error"}`;
        errors.push(errorMessage);
        console.error(errorMessage);
      }
    }
  }

  console.log(`\n\n${dryRun ? "Dry run" : "Migration"} complete!`);
  if (dryRun) {
    console.log(`  Users that would be deleted: ${usersWithoutTwitter.length}`);
    console.log(`  Referral codes that would be updated: ${wouldUpdateCount}`);
    console.log(`  Already matching (no change needed): ${skippedCount}`);
  } else {
    console.log(`  Users deleted: ${usersWithoutTwitter.length}`);
    console.log(`  Referral codes updated: ${updatedCount}`);
    console.log(`  Skipped (already matching or no handle): ${skippedCount}`);
    if (errors.length > 0) {
      console.log(`  Errors: ${errors.length}`);
    }
  }
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
