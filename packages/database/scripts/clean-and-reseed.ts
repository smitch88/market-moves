/**
 * Clean and Re-seed Script
 * 
 * This script removes all existing market data and seeds the Super Bowl Champion 2026 event
 * with all Polymarket-style markets.
 * 
 * Usage: pnpm --filter @vault/database db:clean-and-reseed
 */

import { resolve } from "path";
import { config } from "dotenv";

// Load .env
config({ path: resolve(__dirname, "../.env") });

import { PrismaClient, MarketCategory, MarketStatus, UserRole } from "../src/generated/client";

const prisma = new PrismaClient();

// Parse command line args
const args = process.argv.slice(2);
const preserveUsers = !args.includes("--preserve-nothing");
const dryRun = args.includes("--dry-run");

async function cleanDatabase() {
  console.log("🧹 Cleaning database...\n");
  
  if (dryRun) {
    console.log("   (DRY RUN - no changes will be made)\n");
  }

  // Get counts before deletion
  const counts = {
    raffleEntries: await prisma.raffleEntry.count(),
    tweetProofs: await prisma.tweetProof.count(),
    bets: await prisma.bet.count(),
    positions: await prisma.position.count(),
    markets: await prisma.market.count(),
    events: await prisma.event.count(),
    tags: await prisma.tag.count(),
    balanceLedger: await prisma.balanceLedger.count(),
    adminActionLogs: await prisma.adminActionLog.count(),
    referrals: await prisma.referral.count(),
    users: await prisma.user.count(),
  };

  console.log("   Current data:");
  console.log(`     - ${counts.events} events`);
  console.log(`     - ${counts.markets} markets`);
  console.log(`     - ${counts.bets} bets`);
  console.log(`     - ${counts.positions} positions`);
  console.log(`     - ${counts.tweetProofs} tweet proofs`);
  console.log(`     - ${counts.raffleEntries} raffle entries`);
  console.log(`     - ${counts.tags} tags`);
  console.log(`     - ${counts.users} users\n`);

  if (dryRun) {
    console.log("   Would delete all market-related data.\n");
    return;
  }

  // Delete in order respecting foreign keys
  console.log("   Deleting data in order...\n");

  await prisma.raffleEntry.deleteMany({});
  await prisma.bet.deleteMany({});
  await prisma.tweetProof.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.market.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.adminActionLog.deleteMany({});
  await prisma.balanceLedger.deleteMany({});
  await prisma.referral.deleteMany({});

  if (!preserveUsers) {
    await prisma.user.deleteMany({});
    console.log("   ✓ Deleted all data including users");
  } else {
    await prisma.user.updateMany({
      data: { balance: 10000, balanceLocked: false },
    });
    console.log("   ✓ Deleted all market data, reset user balances to 10,000");
  }

  console.log("\n   ✅ Database cleaned!\n");
}

async function seedDatabase() {
  console.log("🌱 Seeding Super Bowl Champion 2026...\n");

  if (dryRun) {
    console.log("   (DRY RUN - would seed new data)\n");
    return;
  }

  // Create or update admin user
  const admin = await prisma.user.upsert({
    where: { privyUserId: "admin-seed-user" },
    update: { balance: 100000 },
    create: {
      privyUserId: "admin-seed-user",
      handle: "vault_admin",
      name: "Vault Admin",
      role: UserRole.ADMIN,
      balance: 100000,
    },
  });
  console.log("   ✅ Admin user ready:", admin.handle);

  // Create test users
  const testUserData = [
    { privyUserId: "test-user-1", handle: "crypto_whale", name: "Crypto Whale", balance: 50000 },
    { privyUserId: "test-user-2", handle: "sports_guru", name: "Sports Guru", balance: 25000 },
    { privyUserId: "test-user-3", handle: "market_maker", name: "Market Maker", balance: 75000 },
  ];

  for (const userData of testUserData) {
    await prisma.user.upsert({
      where: { privyUserId: userData.privyUserId },
      update: { balance: userData.balance },
      create: userData,
    });
  }
  console.log(`   ✅ ${testUserData.length} test users ready\n`);

  // Create tags
  console.log("   🏷️  Creating tags...");
  const tagData = [
    { slug: "nfl", label: "NFL" },
    { slug: "super-bowl", label: "Super Bowl" },
    { slug: "sports", label: "Sports" },
    { slug: "championship", label: "Championship" },
  ];

  const tags: Record<string, { id: string }> = {};
  for (const tag of tagData) {
    const created = await prisma.tag.upsert({
      where: { slug: tag.slug },
      update: { label: tag.label },
      create: tag,
    });
    tags[tag.slug] = created;
  }
  console.log(`   ✅ ${tagData.length} tags created\n`);

  // Super Bowl LX (2026) - Game Date: February 8, 2026
  const superBowlDate = new Date("2026-02-08T23:30:00Z"); // 6:30 PM ET
  const bettingCloseTime = new Date("2026-02-08T23:00:00Z"); // Close 30 min before kickoff

  // Create the Super Bowl Champion 2026 Event
  console.log("   🏈 Creating Super Bowl Champion 2026 event...\n");

  const event = await prisma.event.create({
    data: {
      slug: "super-bowl-champion-2026",
      title: "Seahawks vs. Patriots",
      description: "Super Bowl LX takes place on February 8, 2026. Predict the champion, game stats, player props, and more.",
      category: MarketCategory.NFL,
      bannerUrl: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200",
      logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a2/Super_Bowl_logo.svg",
      startTime: superBowlDate,
      endTime: superBowlDate,
      active: true,
      closed: false,
      tags: {
        connect: [
          { id: tags["nfl"].id },
          { id: tags["super-bowl"].id },
          { id: tags["sports"].id },
          { id: tags["championship"].id },
        ],
      },
    },
  });

  // =========================================================================
  // ALL MARKETS FROM POLYMARKET DATA (58 total)
  // =========================================================================
  const markets = [
    // ============ GAME LINES (4) ============
    {
      question: "Seahawks vs. Patriots",
      outcomes: ["Seahawks", "Patriots"],
      outcomeColors: ["#002244", "#002244"],
      seed0: 50000,
      seed1: 45000,
      detailsMarkdown: `In the upcoming NFL game, scheduled for February 8 at 6:30PM ET:\nIf Seahawks wins, the market will resolve to "Seahawks".\nIf Patriots wins, the market will resolve to "Patriots".\nIf the game is postponed, this market will remain open until the game has been completed.\nIf the game is canceled entirely or ends in a tie, with no make-up game, this market will resolve 50-50.`,
    },
    {
      question: "Spread: Seahawks (-4.5)",
      outcomes: ["Seahawks -4.5", "Patriots +4.5"],
      outcomeColors: ["#002244", "#002244"],
      seed0: 12000,
      seed1: 12000,
      detailsMarkdown: `Will the Seahawks win by more than 4.5 points?\n\n- "Seahawks -4.5" wins if Seahawks win by 5 or more points.\n- "Patriots +4.5" wins if Patriots win or lose by 4 or fewer points.`,
    },
    {
      question: "Spread: Seahawks (-5.5)",
      outcomes: ["Seahawks -5.5", "Patriots +5.5"],
      outcomeColors: ["#002244", "#002244"],
      seed0: 8000,
      seed1: 10000,
      detailsMarkdown: `Will the Seahawks win by more than 5.5 points?`,
    },
    {
      question: "Seahawks vs. Patriots: O/U 46.5",
      outcomes: ["Over 46.5", "Under 46.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 15000,
      seed1: 14000,
      detailsMarkdown: `Will the combined score of both teams be over or under 46.5 points?`,
    },

    // ============ FIRST HALF (5) ============
    {
      question: "Seahawks vs. Patriots: 1H Moneyline",
      outcomes: ["Seahawks 1H", "Patriots 1H"],
      outcomeColors: ["#002244", "#002244"],
      seed0: 8000,
      seed1: 7500,
      detailsMarkdown: `Which team will be leading at halftime?`,
    },
    {
      question: "1H Spread: Seahawks (-2.5)",
      outcomes: ["Seahawks -2.5 (1H)", "Patriots +2.5 (1H)"],
      outcomeColors: ["#002244", "#002244"],
      seed0: 6000,
      seed1: 6000,
      detailsMarkdown: `First half spread betting. Will Seahawks be leading by 3+ at halftime?`,
    },
    {
      question: "1H Spread: Seahawks (-3.5)",
      outcomes: ["Seahawks -3.5 (1H)", "Patriots +3.5 (1H)"],
      outcomeColors: ["#002244", "#002244"],
      seed0: 5500,
      seed1: 6500,
      detailsMarkdown: `First half spread betting. Will Seahawks be leading by 4+ at halftime?`,
    },
    {
      question: "Seahawks vs. Patriots: 1H O/U 23.5",
      outcomes: ["1H Over 23.5", "1H Under 23.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 7000,
      seed1: 7000,
      detailsMarkdown: `Will the first half total points be over or under 23.5?`,
    },
    {
      question: "Seahawks vs. Patriots: 1H O/U 22.5",
      outcomes: ["1H Over 22.5", "1H Under 22.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 6500,
      seed1: 7500,
      detailsMarkdown: `Will the first half total points be over or under 22.5?`,
    },

    // ============ TEAM TOTALS - SEAHAWKS (7) ============
    {
      question: "Seahawks Team Total: O/U 15.5",
      outcomes: ["Seahawks Over 15.5", "Seahawks Under 15.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 4500,
      seed1: 5500,
      detailsMarkdown: `Will the Seahawks score over or under 15.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 16.5",
      outcomes: ["Seahawks Over 16.5", "Seahawks Under 16.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 4800,
      seed1: 5200,
      detailsMarkdown: `Will the Seahawks score over or under 16.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 17.5",
      outcomes: ["Seahawks Over 17.5", "Seahawks Under 17.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 5000,
      seed1: 5000,
      detailsMarkdown: `Will the Seahawks score over or under 17.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 20.5",
      outcomes: ["Seahawks Over 20.5", "Seahawks Under 20.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 5200,
      seed1: 4800,
      detailsMarkdown: `Will the Seahawks score over or under 20.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 22.5",
      outcomes: ["Seahawks Over 22.5", "Seahawks Under 22.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 5500,
      seed1: 5000,
      detailsMarkdown: `Will the Seahawks score over or under 22.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 23.5",
      outcomes: ["Seahawks Over 23.5", "Seahawks Under 23.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 5000,
      seed1: 5500,
      detailsMarkdown: `Will the Seahawks score over or under 23.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 25.5",
      outcomes: ["Seahawks Over 25.5", "Seahawks Under 25.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 4800,
      seed1: 5200,
      detailsMarkdown: `Will the Seahawks score over or under 25.5 points?`,
    },

    // ============ TEAM TOTALS - PATRIOTS (6) ============
    {
      question: "Patriots Team Total: O/U 15.5",
      outcomes: ["Patriots Over 15.5", "Patriots Under 15.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 4500,
      seed1: 5500,
      detailsMarkdown: `Will the Patriots score over or under 15.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 16.5",
      outcomes: ["Patriots Over 16.5", "Patriots Under 16.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 4800,
      seed1: 5200,
      detailsMarkdown: `Will the Patriots score over or under 16.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 17.5",
      outcomes: ["Patriots Over 17.5", "Patriots Under 17.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 5000,
      seed1: 5000,
      detailsMarkdown: `Will the Patriots score over or under 17.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 20.5",
      outcomes: ["Patriots Over 20.5", "Patriots Under 20.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 5200,
      seed1: 4800,
      detailsMarkdown: `Will the Patriots score over or under 20.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 21.5",
      outcomes: ["Patriots Over 21.5", "Patriots Under 21.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 5000,
      seed1: 5500,
      detailsMarkdown: `Will the Patriots score over or under 21.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 29.5",
      outcomes: ["Patriots Over 29.5", "Patriots Under 29.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 3500,
      seed1: 6500,
      detailsMarkdown: `Will the Patriots score over or under 29.5 points?`,
    },

    // ============ ANYTIME TOUCHDOWNS (10) ============
    {
      question: "AJ Barner: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 3600,
      seed1: 6400,
      detailsMarkdown: `Will AJ Barner score a touchdown at any point in the game?`,
    },
    {
      question: "Stefon Diggs: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 3600,
      seed1: 6400,
      detailsMarkdown: `Will Stefon Diggs score a touchdown at any point in the game?`,
    },
    {
      question: "Jaxon Smith-Njigba: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 5600,
      seed1: 4400,
      detailsMarkdown: `Will Jaxon Smith-Njigba score a touchdown at any point in the game?`,
    },
    {
      question: "Rhamondre Stevenson: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 4300,
      seed1: 5700,
      detailsMarkdown: `Will Rhamondre Stevenson score a touchdown at any point in the game?`,
    },
    {
      question: "Hunter Henry: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 3700,
      seed1: 6300,
      detailsMarkdown: `Will Hunter Henry score a touchdown at any point in the game?`,
    },
    {
      question: "Cooper Kupp: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 3200,
      seed1: 6800,
      detailsMarkdown: `Will Cooper Kupp score a touchdown at any point in the game?`,
    },
    {
      question: "Kayshon Boutte: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 2800,
      seed1: 7200,
      detailsMarkdown: `Will Kayshon Boutte score a touchdown at any point in the game?`,
    },
    {
      question: "Mack Hollins: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 2400,
      seed1: 7600,
      detailsMarkdown: `Will Mack Hollins score a touchdown at any point in the game?`,
    },
    {
      question: "Kenneth Walker III: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 6800,
      seed1: 3200,
      detailsMarkdown: `Will Kenneth Walker III score a touchdown at any point in the game?`,
    },
    {
      question: "Rashid Shaheed: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 2400,
      seed1: 7600,
      detailsMarkdown: `Will Rashid Shaheed score a touchdown at any point in the game?`,
    },

    // ============ FIRST TOUCHDOWNS (10) ============
    {
      question: "Jaxon Smith-Njigba: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 2000,
      seed1: 8000,
      detailsMarkdown: `Will Jaxon Smith-Njigba score the first touchdown of the game?`,
    },
    {
      question: "AJ Barner: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 1500,
      seed1: 8500,
      detailsMarkdown: `Will AJ Barner score the first touchdown of the game?`,
    },
    {
      question: "Stefon Diggs: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 1800,
      seed1: 8200,
      detailsMarkdown: `Will Stefon Diggs score the first touchdown of the game?`,
    },
    {
      question: "Rashid Shaheed: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 1200,
      seed1: 8800,
      detailsMarkdown: `Will Rashid Shaheed score the first touchdown of the game?`,
    },
    {
      question: "Kenneth Walker III: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 2500,
      seed1: 7500,
      detailsMarkdown: `Will Kenneth Walker III score the first touchdown of the game?`,
    },
    {
      question: "Rhamondre Stevenson: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 2000,
      seed1: 8000,
      detailsMarkdown: `Will Rhamondre Stevenson score the first touchdown of the game?`,
    },
    {
      question: "Hunter Henry: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 1500,
      seed1: 8500,
      detailsMarkdown: `Will Hunter Henry score the first touchdown of the game?`,
    },
    {
      question: "Mack Hollins: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 1200,
      seed1: 8800,
      detailsMarkdown: `Will Mack Hollins score the first touchdown of the game?`,
    },
    {
      question: "Cooper Kupp: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 1400,
      seed1: 8600,
      detailsMarkdown: `Will Cooper Kupp score the first touchdown of the game?`,
    },
    {
      question: "Kayshon Boutte: First Touchdown",
      outcomes: ["Yes", "No"],
      outcomeColors: ["#22C55E", "#6B7280"],
      seed0: 1000,
      seed1: 9000,
      detailsMarkdown: `Will Kayshon Boutte score the first touchdown of the game?`,
    },

    // ============ RUSHING YARDS (6) ============
    {
      question: "AJ Barner: Rushing Yards O/U 0.5",
      outcomes: ["Over 0.5", "Under 0.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 5350,
      seed1: 4650,
      detailsMarkdown: `Will AJ Barner record 1 or more rushing yards in regulation and overtime combined?`,
    },
    {
      question: "Drake Maye: Rushing Yards O/U 29.5",
      outcomes: ["Over 29.5", "Under 29.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 8300,
      seed1: 1700,
      detailsMarkdown: `Will Drake Maye rush for over or under 29.5 yards?`,
    },
    {
      question: "Sam Darnold: Rushing Yards O/U 239.5",
      outcomes: ["Over 239.5", "Under 239.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 100,
      seed1: 9900,
      detailsMarkdown: `Will Sam Darnold rush for over or under 239.5 yards?`,
    },
    {
      question: "Rhamondre Stevenson: Rushing Yards O/U 56.5",
      outcomes: ["Over 56.5", "Under 56.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9600,
      seed1: 400,
      detailsMarkdown: `Will Rhamondre Stevenson rush for over or under 56.5 yards?`,
    },
    {
      question: "TreVeyon Henderson: Rushing Yards O/U 19.5",
      outcomes: ["Over 19.5", "Under 19.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will TreVeyon Henderson rush for over or under 19.5 yards?`,
    },
    {
      question: "Kenneth Walker III: Rushing Yards O/U 80.5",
      outcomes: ["Over 80.5", "Under 80.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 4400,
      seed1: 5600,
      detailsMarkdown: `Will Kenneth Walker III rush for over or under 80.5 yards?`,
    },

    // ============ RECEIVING YARDS (10) ============
    {
      question: "Rhamondre Stevenson: Receiving Yards O/U 20.5",
      outcomes: ["Over 20.5", "Under 20.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9600,
      seed1: 400,
      detailsMarkdown: `Will Rhamondre Stevenson have over or under 20.5 receiving yards?`,
    },
    {
      question: "Jaxon Smith-Njigba: Receiving Yards O/U 90.5",
      outcomes: ["Over 90.5", "Under 90.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Jaxon Smith-Njigba have over or under 90.5 receiving yards?`,
    },
    {
      question: "Mack Hollins: Receiving Yards O/U 28.5",
      outcomes: ["Over 28.5", "Under 28.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Mack Hollins have over or under 28.5 receiving yards?`,
    },
    {
      question: "Kayshon Boutte: Receiving Yards O/U 0.5",
      outcomes: ["Over 0.5", "Under 0.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9400,
      seed1: 600,
      detailsMarkdown: `Will Kayshon Boutte record 1 or more receiving yards?`,
    },
    {
      question: "Hunter Henry: Receiving Yards O/U 37.5",
      outcomes: ["Over 37.5", "Under 37.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Hunter Henry have over or under 37.5 receiving yards?`,
    },
    {
      question: "Cooper Kupp: Receiving Yards O/U 29.5",
      outcomes: ["Over 29.5", "Under 29.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Cooper Kupp have over or under 29.5 receiving yards?`,
    },
    {
      question: "AJ Barner: Receiving Yards O/U 1.5",
      outcomes: ["Over 1.5", "Under 1.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9800,
      seed1: 200,
      detailsMarkdown: `Will AJ Barner have over or under 1.5 receiving yards?`,
    },
    {
      question: "Rashid Shaheed: Receiving Yards O/U 22.5",
      outcomes: ["Over 22.5", "Under 22.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Rashid Shaheed have over or under 22.5 receiving yards?`,
    },
    {
      question: "Stefon Diggs: Receiving Yards O/U 5.5",
      outcomes: ["Over 5.5", "Under 5.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 9600,
      seed1: 400,
      detailsMarkdown: `Will Stefon Diggs have over or under 5.5 receiving yards?`,
    },
    {
      question: "Kenneth Walker III: Receiving Yards O/U 101.5",
      outcomes: ["Over 101.5", "Under 101.5"],
      outcomeColors: ["#22C55E", "#EF4444"],
      seed0: 810,
      seed1: 9190,
      detailsMarkdown: `Will Kenneth Walker III have over or under 101.5 receiving yards?`,
    },
  ];

  // Create all markets
  console.log("   📈 Creating markets...\n");

  let categoryCount = {
    "Game Lines": 0,
    "1st Half": 0,
    "Team Totals": 0,
    "Touchdowns": 0,
    "Rushing": 0,
    "Receiving": 0,
  };

  for (const marketData of markets) {
    const { outcomes, outcomeColors, ...marketFields } = marketData;
    
    await prisma.market.create({
      data: {
        eventId: event.id,
        ...marketFields,
        closesAt: bettingCloseTime,
        outcomes: JSON.stringify(outcomes),
        outcomePrices: JSON.stringify(["0.50", "0.50"]),
        outcomeColors: outcomeColors ? JSON.stringify(outcomeColors) : null,
        status: MarketStatus.OPEN,
        publishedAt: new Date(),
        opensAt: new Date(),
      },
    });

    // Count by category
    const q = marketData.question;
    if (q.includes("vs.") || q.includes("Spread:") || (q.includes("O/U") && !q.includes("1H") && !q.includes("Team Total") && !q.includes(":"))) {
      categoryCount["Game Lines"]++;
    } else if (q.includes("1H")) {
      categoryCount["1st Half"]++;
    } else if (q.includes("Team Total")) {
      categoryCount["Team Totals"]++;
    } else if (q.includes("Touchdown")) {
      categoryCount["Touchdowns"]++;
    } else if (q.includes("Rushing")) {
      categoryCount["Rushing"]++;
    } else if (q.includes("Receiving")) {
      categoryCount["Receiving"]++;
    }
  }

  console.log("   Market breakdown:");
  for (const [cat, count] of Object.entries(categoryCount)) {
    console.log(`     - ${cat}: ${count}`);
  }

  console.log(`\n   🎉 Created 1 event with ${markets.length} markets!\n`);
  
  // Summary
  const marketCount = await prisma.market.count();
  const userCount = await prisma.user.count();
  console.log(`   📊 Total: ${marketCount} markets, ${userCount} users`);
}

async function main() {
  console.log("\n" + "=".repeat(60));
  console.log("   VAULT MARKETS - Super Bowl Champion 2026 Setup");
  console.log("=".repeat(60) + "\n");

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  try {
    await cleanDatabase();
    await seedDatabase();
    
    console.log("\n" + "=".repeat(60));
    console.log("   ✅ Setup completed successfully!");
    console.log("=".repeat(60) + "\n");
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
