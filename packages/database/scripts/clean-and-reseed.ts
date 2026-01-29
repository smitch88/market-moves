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

import { PrismaClient, MarketCategory, MarketStatus, UserRole, PricingModel, EventType } from "../src/generated/client";

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
    priceSnapshots: await prisma.priceSnapshot.count(),
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
  console.log(`     - ${counts.priceSnapshots} price snapshots`);
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
  await prisma.priceSnapshot.deleteMany({});
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
      data: { balance: "10000.00", balanceLocked: false }, // $10,000
    });
    console.log("   ✓ Deleted all market data, reset user balances to $10,000");
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
    update: { balance: "100000.00" }, // $100,000
    create: {
      privyUserId: "admin-seed-user",
      handle: "vault_admin",
      name: "Vault Admin",
      role: UserRole.ADMIN,
      balance: "100000.00", // $100,000
    },
  });
  console.log("   ✅ Admin user ready:", admin.handle);

  // Create test users
  const testUserData = [
    { privyUserId: "test-user-1", handle: "crypto_whale", name: "Crypto Whale", balance: "50000.00" }, // $50,000
    { privyUserId: "test-user-2", handle: "sports_guru", name: "Sports Guru", balance: "25000.00" }, // $25,000
    { privyUserId: "test-user-3", handle: "market_maker", name: "Market Maker", balance: "75000.00" }, // $75,000
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
      eventType: EventType.MATCHUP,
      bannerUrl: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200",
      logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a2/Super_Bowl_logo.svg",
      startTime: superBowlDate,
      endTime: superBowlDate,
      active: true,
      closed: false,
      featured: true, // Mark as featured for home page carousel
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
      seed0: 50000,
      seed1: 45000,
      detailsMarkdown: `In the upcoming NFL game, scheduled for February 8 at 6:30PM ET:\nIf Seahawks wins, the market will resolve to "Seahawks".\nIf Patriots wins, the market will resolve to "Patriots".\nIf the game is postponed, this market will remain open until the game has been completed.\nIf the game is canceled entirely or ends in a tie, with no make-up game, this market will resolve 50-50.`,
    },
    {
      question: "Spread: Seahawks (-4.5)",
      outcomes: ["Seahawks -4.5", "Patriots +4.5"],
      seed0: 12000,
      seed1: 12000,
      detailsMarkdown: `Will the Seahawks win by more than 4.5 points?\n\n- "Seahawks -4.5" wins if Seahawks win by 5 or more points.\n- "Patriots +4.5" wins if Patriots win or lose by 4 or fewer points.`,
    },
    {
      question: "Spread: Seahawks (-5.5)",
      outcomes: ["Seahawks -5.5", "Patriots +5.5"],
      seed0: 8000,
      seed1: 10000,
      detailsMarkdown: `Will the Seahawks win by more than 5.5 points?`,
    },
    {
      question: "Seahawks vs. Patriots: O/U 46.5",
      outcomes: ["Over 46.5", "Under 46.5"],
      seed0: 15000,
      seed1: 14000,
      detailsMarkdown: `Will the combined score of both teams be over or under 46.5 points?`,
    },

    // ============ FIRST HALF (5) ============
    {
      question: "Seahawks vs. Patriots: 1H Moneyline",
      outcomes: ["Seahawks 1H", "Patriots 1H"],
      seed0: 8000,
      seed1: 7500,
      detailsMarkdown: `Which team will be leading at halftime?`,
    },
    {
      question: "1H Spread: Seahawks (-2.5)",
      outcomes: ["Seahawks -2.5 (1H)", "Patriots +2.5 (1H)"],
      seed0: 6000,
      seed1: 6000,
      detailsMarkdown: `First half spread betting. Will Seahawks be leading by 3+ at halftime?`,
    },
    {
      question: "1H Spread: Seahawks (-3.5)",
      outcomes: ["Seahawks -3.5 (1H)", "Patriots +3.5 (1H)"],
      seed0: 5500,
      seed1: 6500,
      detailsMarkdown: `First half spread betting. Will Seahawks be leading by 4+ at halftime?`,
    },
    {
      question: "Seahawks vs. Patriots: 1H O/U 23.5",
      outcomes: ["1H Over 23.5", "1H Under 23.5"],
      seed0: 7000,
      seed1: 7000,
      detailsMarkdown: `Will the first half total points be over or under 23.5?`,
    },
    {
      question: "Seahawks vs. Patriots: 1H O/U 22.5",
      outcomes: ["1H Over 22.5", "1H Under 22.5"],
      seed0: 6500,
      seed1: 7500,
      detailsMarkdown: `Will the first half total points be over or under 22.5?`,
    },

    // ============ TEAM TOTALS - SEAHAWKS (7) ============
    {
      question: "Seahawks Team Total: O/U 15.5",
      outcomes: ["Seahawks Over 15.5", "Seahawks Under 15.5"],
      seed0: 4500,
      seed1: 5500,
      detailsMarkdown: `Will the Seahawks score over or under 15.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 16.5",
      outcomes: ["Seahawks Over 16.5", "Seahawks Under 16.5"],
      seed0: 4800,
      seed1: 5200,
      detailsMarkdown: `Will the Seahawks score over or under 16.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 17.5",
      outcomes: ["Seahawks Over 17.5", "Seahawks Under 17.5"],
      seed0: 5000,
      seed1: 5000,
      detailsMarkdown: `Will the Seahawks score over or under 17.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 20.5",
      outcomes: ["Seahawks Over 20.5", "Seahawks Under 20.5"],
      seed0: 5200,
      seed1: 4800,
      detailsMarkdown: `Will the Seahawks score over or under 20.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 22.5",
      outcomes: ["Seahawks Over 22.5", "Seahawks Under 22.5"],
      seed0: 5500,
      seed1: 5000,
      detailsMarkdown: `Will the Seahawks score over or under 22.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 23.5",
      outcomes: ["Seahawks Over 23.5", "Seahawks Under 23.5"],
      seed0: 5000,
      seed1: 5500,
      detailsMarkdown: `Will the Seahawks score over or under 23.5 points?`,
    },
    {
      question: "Seahawks Team Total: O/U 25.5",
      outcomes: ["Seahawks Over 25.5", "Seahawks Under 25.5"],
      seed0: 4800,
      seed1: 5200,
      detailsMarkdown: `Will the Seahawks score over or under 25.5 points?`,
    },

    // ============ TEAM TOTALS - PATRIOTS (6) ============
    {
      question: "Patriots Team Total: O/U 15.5",
      outcomes: ["Patriots Over 15.5", "Patriots Under 15.5"],
      seed0: 4500,
      seed1: 5500,
      detailsMarkdown: `Will the Patriots score over or under 15.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 16.5",
      outcomes: ["Patriots Over 16.5", "Patriots Under 16.5"],
      seed0: 4800,
      seed1: 5200,
      detailsMarkdown: `Will the Patriots score over or under 16.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 17.5",
      outcomes: ["Patriots Over 17.5", "Patriots Under 17.5"],
      seed0: 5000,
      seed1: 5000,
      detailsMarkdown: `Will the Patriots score over or under 17.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 20.5",
      outcomes: ["Patriots Over 20.5", "Patriots Under 20.5"],
      seed0: 5200,
      seed1: 4800,
      detailsMarkdown: `Will the Patriots score over or under 20.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 21.5",
      outcomes: ["Patriots Over 21.5", "Patriots Under 21.5"],
      seed0: 5000,
      seed1: 5500,
      detailsMarkdown: `Will the Patriots score over or under 21.5 points?`,
    },
    {
      question: "Patriots Team Total: O/U 29.5",
      outcomes: ["Patriots Over 29.5", "Patriots Under 29.5"],
      seed0: 3500,
      seed1: 6500,
      detailsMarkdown: `Will the Patriots score over or under 29.5 points?`,
    },

    // ============ ANYTIME TOUCHDOWNS (10) ============
    {
      question: "AJ Barner: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 3600,
      seed1: 6400,
      detailsMarkdown: `Will AJ Barner score a touchdown at any point in the game?`,
    },
    {
      question: "Stefon Diggs: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 3600,
      seed1: 6400,
      detailsMarkdown: `Will Stefon Diggs score a touchdown at any point in the game?`,
    },
    {
      question: "Jaxon Smith-Njigba: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 5600,
      seed1: 4400,
      detailsMarkdown: `Will Jaxon Smith-Njigba score a touchdown at any point in the game?`,
    },
    {
      question: "Rhamondre Stevenson: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 4300,
      seed1: 5700,
      detailsMarkdown: `Will Rhamondre Stevenson score a touchdown at any point in the game?`,
    },
    {
      question: "Hunter Henry: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 3700,
      seed1: 6300,
      detailsMarkdown: `Will Hunter Henry score a touchdown at any point in the game?`,
    },
    {
      question: "Cooper Kupp: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 3200,
      seed1: 6800,
      detailsMarkdown: `Will Cooper Kupp score a touchdown at any point in the game?`,
    },
    {
      question: "Kayshon Boutte: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 2800,
      seed1: 7200,
      detailsMarkdown: `Will Kayshon Boutte score a touchdown at any point in the game?`,
    },
    {
      question: "Mack Hollins: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 2400,
      seed1: 7600,
      detailsMarkdown: `Will Mack Hollins score a touchdown at any point in the game?`,
    },
    {
      question: "Kenneth Walker III: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 6800,
      seed1: 3200,
      detailsMarkdown: `Will Kenneth Walker III score a touchdown at any point in the game?`,
    },
    {
      question: "Rashid Shaheed: Anytime Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 2400,
      seed1: 7600,
      detailsMarkdown: `Will Rashid Shaheed score a touchdown at any point in the game?`,
    },

    // ============ FIRST TOUCHDOWNS (10) ============
    {
      question: "Jaxon Smith-Njigba: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 2000,
      seed1: 8000,
      detailsMarkdown: `Will Jaxon Smith-Njigba score the first touchdown of the game?`,
    },
    {
      question: "AJ Barner: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 1500,
      seed1: 8500,
      detailsMarkdown: `Will AJ Barner score the first touchdown of the game?`,
    },
    {
      question: "Stefon Diggs: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 1800,
      seed1: 8200,
      detailsMarkdown: `Will Stefon Diggs score the first touchdown of the game?`,
    },
    {
      question: "Rashid Shaheed: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 1200,
      seed1: 8800,
      detailsMarkdown: `Will Rashid Shaheed score the first touchdown of the game?`,
    },
    {
      question: "Kenneth Walker III: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 2500,
      seed1: 7500,
      detailsMarkdown: `Will Kenneth Walker III score the first touchdown of the game?`,
    },
    {
      question: "Rhamondre Stevenson: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 2000,
      seed1: 8000,
      detailsMarkdown: `Will Rhamondre Stevenson score the first touchdown of the game?`,
    },
    {
      question: "Hunter Henry: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 1500,
      seed1: 8500,
      detailsMarkdown: `Will Hunter Henry score the first touchdown of the game?`,
    },
    {
      question: "Mack Hollins: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 1200,
      seed1: 8800,
      detailsMarkdown: `Will Mack Hollins score the first touchdown of the game?`,
    },
    {
      question: "Cooper Kupp: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 1400,
      seed1: 8600,
      detailsMarkdown: `Will Cooper Kupp score the first touchdown of the game?`,
    },
    {
      question: "Kayshon Boutte: First Touchdown",
      outcomes: ["Yes", "No"],
      seed0: 1000,
      seed1: 9000,
      detailsMarkdown: `Will Kayshon Boutte score the first touchdown of the game?`,
    },

    // ============ RUSHING YARDS (6) ============
    {
      question: "AJ Barner: Rushing Yards O/U 0.5",
      outcomes: ["Over 0.5", "Under 0.5"],
      seed0: 5350,
      seed1: 4650,
      detailsMarkdown: `Will AJ Barner record 1 or more rushing yards in regulation and overtime combined?`,
    },
    {
      question: "Drake Maye: Rushing Yards O/U 29.5",
      outcomes: ["Over 29.5", "Under 29.5"],
      seed0: 8300,
      seed1: 1700,
      detailsMarkdown: `Will Drake Maye rush for over or under 29.5 yards?`,
    },
    {
      question: "Sam Darnold: Rushing Yards O/U 239.5",
      outcomes: ["Over 239.5", "Under 239.5"],
      seed0: 100,
      seed1: 9900,
      detailsMarkdown: `Will Sam Darnold rush for over or under 239.5 yards?`,
    },
    {
      question: "Rhamondre Stevenson: Rushing Yards O/U 56.5",
      outcomes: ["Over 56.5", "Under 56.5"],
      seed0: 9600,
      seed1: 400,
      detailsMarkdown: `Will Rhamondre Stevenson rush for over or under 56.5 yards?`,
    },
    {
      question: "TreVeyon Henderson: Rushing Yards O/U 19.5",
      outcomes: ["Over 19.5", "Under 19.5"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will TreVeyon Henderson rush for over or under 19.5 yards?`,
    },
    {
      question: "Kenneth Walker III: Rushing Yards O/U 80.5",
      outcomes: ["Over 80.5", "Under 80.5"],
      seed0: 4400,
      seed1: 5600,
      detailsMarkdown: `Will Kenneth Walker III rush for over or under 80.5 yards?`,
    },

    // ============ RECEIVING YARDS (10) ============
    {
      question: "Rhamondre Stevenson: Receiving Yards O/U 20.5",
      outcomes: ["Over 20.5", "Under 20.5"],
      seed0: 9600,
      seed1: 400,
      detailsMarkdown: `Will Rhamondre Stevenson have over or under 20.5 receiving yards?`,
    },
    {
      question: "Jaxon Smith-Njigba: Receiving Yards O/U 90.5",
      outcomes: ["Over 90.5", "Under 90.5"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Jaxon Smith-Njigba have over or under 90.5 receiving yards?`,
    },
    {
      question: "Mack Hollins: Receiving Yards O/U 28.5",
      outcomes: ["Over 28.5", "Under 28.5"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Mack Hollins have over or under 28.5 receiving yards?`,
    },
    {
      question: "Kayshon Boutte: Receiving Yards O/U 0.5",
      outcomes: ["Over 0.5", "Under 0.5"],
      seed0: 9400,
      seed1: 600,
      detailsMarkdown: `Will Kayshon Boutte record 1 or more receiving yards?`,
    },
    {
      question: "Hunter Henry: Receiving Yards O/U 37.5",
      outcomes: ["Over 37.5", "Under 37.5"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Hunter Henry have over or under 37.5 receiving yards?`,
    },
    {
      question: "Cooper Kupp: Receiving Yards O/U 29.5",
      outcomes: ["Over 29.5", "Under 29.5"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Cooper Kupp have over or under 29.5 receiving yards?`,
    },
    {
      question: "AJ Barner: Receiving Yards O/U 1.5",
      outcomes: ["Over 1.5", "Under 1.5"],
      seed0: 9800,
      seed1: 200,
      detailsMarkdown: `Will AJ Barner have over or under 1.5 receiving yards?`,
    },
    {
      question: "Rashid Shaheed: Receiving Yards O/U 22.5",
      outcomes: ["Over 22.5", "Under 22.5"],
      seed0: 9700,
      seed1: 300,
      detailsMarkdown: `Will Rashid Shaheed have over or under 22.5 receiving yards?`,
    },
    {
      question: "Stefon Diggs: Receiving Yards O/U 5.5",
      outcomes: ["Over 5.5", "Under 5.5"],
      seed0: 9600,
      seed1: 400,
      detailsMarkdown: `Will Stefon Diggs have over or under 5.5 receiving yards?`,
    },
    {
      question: "Kenneth Walker III: Receiving Yards O/U 101.5",
      outcomes: ["Over 101.5", "Under 101.5"],
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
    
    // Set up CPMM reserves from seed values
    // Reserves represent share liquidity (not scaled)
    const reserve0 = marketFields.seed0 || 1000; // Reserves are in shares
    const reserve1 = marketFields.seed1 || 1000; // Reserves are in shares
    const k = reserve0 * reserve1; // CPMM invariant
    
    // Calculate initial prices using CPMM formula
    // In CPMM: price0 = reserve1 / (reserve0 + reserve1)
    const total = reserve0 + reserve1;
    const price0 = (reserve1 / total).toFixed(4);
    const price1 = (reserve0 / total).toFixed(4);
    
    const market = await prisma.market.create({
      data: {
        eventId: event.id,
        ...marketFields,
        closesAt: bettingCloseTime,
        outcomes: JSON.stringify(outcomes),
        outcomePrices: JSON.stringify([price0, price1]),
        // CPMM pricing model
        pricingModel: PricingModel.CPMM,
        reserve0,
        reserve1,
        k,
        status: MarketStatus.OPEN,
        publishedAt: new Date(),
        opensAt: new Date(),
      },
    });

    // Create initial price snapshot for chart history
    await prisma.priceSnapshot.create({
      data: {
        marketId: market.id,
        price0: parseFloat(price0),
        price1: parseFloat(price1),
        pool0: Math.floor(reserve0),
        pool1: Math.floor(reserve1),
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

  // =========================================================================
  // SUPER BOWL LX MVP EVENT
  // =========================================================================
  console.log("   🏆 Creating Super Bowl LX MVP event...\n");

  const mvpEvent = await prisma.event.create({
    data: {
      slug: "super-bowl-lx-mvp",
      title: "Super Bowl LX MVP",
      description: "This market will resolve according to the winner of the Super Bowl LX MVP Award.\n\nIf two or more players are announced as winners of the Super Bowl LX MVP Award, this market will resolve to the player whose listed last name comes first alphabetically.\n\nIf Super Bowl LX has not been completed, the MVP award winner is not announced by February 22, 2026, 11:59 PM ET, or no participant is crowned as the MVP, then this market will resolve to \"Other\". \n\nThe primary resolution source for this market will be official information from the NFL; however, a consensus of credible reporting may also be used.",
      category: MarketCategory.NFL,
      eventType: EventType.PROP,
      bannerUrl: "https://polymarket-upload.s3.us-east-2.amazonaws.com/super-bowl-lx-mvp-_aZLytAy-ag7.jpg",
      logoUrl: "https://polymarket-upload.s3.us-east-2.amazonaws.com/super-bowl-lx-mvp-_aZLytAy-ag7.jpg",
      startTime: new Date("2026-01-26T17:25:52.925081Z"),
      endTime: new Date("2026-02-08T23:55:00Z"),
      active: true,
      closed: false,
      tags: {
        connect: [
          { id: tags["nfl"].id },
          { id: tags["super-bowl"].id },
        ],
      },
    },
  });

  const mvpMarkets = [
    {
      question: "Will Sam Darnold win the Super Bowl LX MVP?",
      displayLabel: "Sam Darnold",
      outcomes: ["Yes", "No"],
      seed0: 202222,
      seed1: 268574,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Drake Maye win the Super Bowl LX MVP?",
      displayLabel: "Drake Maye",
      outcomes: ["Yes", "No"],
      seed0: 176985,
      seed1: 492015,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Jaxon Smith-Njigba win the Super Bowl LX MVP?",
      displayLabel: "Jaxon Smith-Njigba",
      outcomes: ["Yes", "No"],
      seed0: 131635,
      seed1: 843365,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Kenneth Walker III win the Super Bowl LX MVP?",
      displayLabel: "Kenneth Walker III",
      outcomes: ["Yes", "No"],
      seed0: 19315,
      seed1: 197685,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Rhamondre Stevenson win the Super Bowl LX MVP?",
      displayLabel: "Rhamondre Stevenson",
      outcomes: ["Yes", "No"],
      seed0: 16247,
      seed1: 912753,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Rashid Shaheed win the Super Bowl LX MVP?",
      displayLabel: "Rashid Shaheed",
      outcomes: ["Yes", "No"],
      seed0: 36766,
      seed1: 2263234,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Stefon Diggs win the Super Bowl LX MVP?",
      displayLabel: "Stefon Diggs",
      outcomes: ["Yes", "No"],
      seed0: 43663,
      seed1: 6193337,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Nick Emmanwori win the Super Bowl LX MVP?",
      displayLabel: "Nick Emmanwori",
      outcomes: ["Yes", "No"],
      seed0: 25211,
      seed1: 3976789,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Jason Myers win the Super Bowl LX MVP?",
      displayLabel: "Jason Myers",
      outcomes: ["Yes", "No"],
      seed0: 32163,
      seed1: 6400837,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will DeMarcus Lawrence win the Super Bowl LX MVP?",
      displayLabel: "DeMarcus Lawrence",
      outcomes: ["Yes", "No"],
      seed0: 21577,
      seed1: 8607423,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Cooper Kupp win the Super Bowl LX MVP?",
      displayLabel: "Cooper Kupp",
      outcomes: ["Yes", "No"],
      seed0: 24811,
      seed1: 4513189,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Leonard Williams win the Super Bowl LX MVP?",
      displayLabel: "Leonard Williams",
      outcomes: ["Yes", "No"],
      seed0: 25350,
      seed1: 8441650,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Marcus Jones win the Super Bowl LX MVP?",
      displayLabel: "Marcus Jones",
      outcomes: ["Yes", "No"],
      seed0: 43457,
      seed1: 9622043,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Kayshon Boutte win the Super Bowl LX MVP?",
      displayLabel: "Kayshon Boutte",
      outcomes: ["Yes", "No"],
      seed0: 22680,
      seed1: 3757320,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Byron Murphy win the Super Bowl LX MVP?",
      displayLabel: "Byron Murphy",
      outcomes: ["Yes", "No"],
      seed0: 28542,
      seed1: 9505458,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Devon Witherspoon win the Super Bowl LX MVP?",
      displayLabel: "Devon Witherspoon",
      outcomes: ["Yes", "No"],
      seed0: 23839,
      seed1: 7941161,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Hunter Henry win the Super Bowl LX MVP?",
      displayLabel: "Hunter Henry",
      outcomes: ["Yes", "No"],
      seed0: 9871,
      seed1: 2812129,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Coby Bryant win the Super Bowl LX MVP?",
      displayLabel: "Coby Bryant",
      outcomes: ["Yes", "No"],
      seed0: 26164,
      seed1: 6514836,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Ernest Jones win the Super Bowl LX MVP?",
      displayLabel: "Ernest Jones",
      outcomes: ["Yes", "No"],
      seed0: 25251,
      seed1: 5025749,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Mack Hollins win the Super Bowl LX MVP?",
      displayLabel: "Mack Hollins",
      outcomes: ["Yes", "No"],
      seed0: 25493,
      seed1: 4232507,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will AJ Barner win the Super Bowl LX MVP?",
      displayLabel: "AJ Barner",
      outcomes: ["Yes", "No"],
      seed0: 42670,
      seed1: 17067330,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will TreVeyon Henderson win the Super Bowl LX MVP?",
      displayLabel: "TreVeyon Henderson",
      outcomes: ["Yes", "No"],
      seed0: 25829,
      seed1: 4304171,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Jake Bobo win the Super Bowl LX MVP?",
      displayLabel: "Jake Bobo",
      outcomes: ["Yes", "No"],
      seed0: 29914,
      seed1: 9971086,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Milton Williams win the Super Bowl LX MVP?",
      displayLabel: "Milton Williams",
      outcomes: ["Yes", "No"],
      seed0: 30132,
      seed1: 12052868,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Christian Gonzalez win the Super Bowl LX MVP?",
      displayLabel: "Christian Gonzalez",
      outcomes: ["Yes", "No"],
      seed0: 40812,
      seed1: 16324188,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Andres Borregales win the Super Bowl LX MVP?",
      displayLabel: "Andres Borregales",
      outcomes: ["Yes", "No"],
      seed0: 32076,
      seed1: 7993924,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Uchenna Nwosu win the Super Bowl LX MVP?",
      displayLabel: "Uchenna Nwosu",
      outcomes: ["Yes", "No"],
      seed0: 37893,
      seed1: 12621107,
      detailsMarkdown: "This market will resolve according to the winner of the Super Bowl LX MVP Award.",
    },
    {
      question: "Will Other Player win the Super Bowl LX MVP?",
      displayLabel: "Other Player",
      outcomes: ["Yes", "No"],
      seed0: 5000,
      seed1: 5000,
      detailsMarkdown: "This market will resolve to \"Yes\" if any player not listed in the other markets wins the Super Bowl LX MVP Award.",
    },
  ];

  let mvpMarketCount = 0;
  for (const marketData of mvpMarkets) {
    const { outcomes, outcomeColors, ...marketFields } = marketData;
    
    const reserve0 = marketFields.seed0 || 5000;
    const reserve1 = marketFields.seed1 || 5000;
    const k = reserve0 * reserve1;
    
    const total = reserve0 + reserve1;
    const price0 = (reserve1 / total).toFixed(4);
    const price1 = (reserve0 / total).toFixed(4);
    
    const market = await prisma.market.create({
      data: {
        eventId: mvpEvent.id,
        ...marketFields,
        closesAt: new Date("2026-02-08T23:55:00Z"),
        outcomes: JSON.stringify(outcomes),
        outcomePrices: JSON.stringify([price0, price1]),
        pricingModel: PricingModel.CPMM,
        reserve0,
        reserve1,
        k,
        status: MarketStatus.OPEN,
        publishedAt: new Date(),
        opensAt: new Date(),
      },
    });

    await prisma.priceSnapshot.create({
      data: {
        marketId: market.id,
        price0: parseFloat(price0),
        price1: parseFloat(price1),
        pool0: Math.floor(reserve0),
        pool1: Math.floor(reserve1),
      },
    });

    mvpMarketCount++;
  }

  console.log(`   🎉 Created Super Bowl LX MVP event with ${mvpMarketCount} markets!\n`);

  // =========================================================================
  // SUPER BOWL LX HALFTIME SHOW PERFORMERS EVENT
  // =========================================================================
  console.log("   🎤 Creating Super Bowl LX Halftime Show performers event...\n");

  const halftimeEvent = await prisma.event.create({
    data: {
      slug: "super-bowl-lx-halftime-show",
      title: "Who will perform at Super Bowl halftime show?",
      description: "This is a market on predicting the performers for the Super Bowl LX halftime show.",
      category: MarketCategory.NFL,
      eventType: EventType.PROP,
      bannerUrl: "https://polymarket-upload.s3.us-east-2.amazonaws.com/who-will-perform-at-super-bowl-halftime-show--VOuEXVR7f71.jpg",
      logoUrl: "https://polymarket-upload.s3.us-east-2.amazonaws.com/who-will-perform-at-super-bowl-halftime-show--VOuEXVR7f71.jpg",
      startTime: new Date("2025-06-25T22:32:40.204055Z"),
      endTime: new Date("2026-02-09T00:00:00Z"),
      active: true,
      closed: false,
      tags: {
        connect: [
          { id: tags["nfl"].id },
          { id: tags["super-bowl"].id },
        ],
      },
    },
  });

  const halftimeMarkets = [
    {
      question: "Will Bad Bunny perform during the Super Bowl LX halftime show?",
      displayLabel: "Bad Bunny",
      outcomes: ["Yes", "No"],
      seed0: 13028,
      seed1: 176,
      detailsMarkdown: "This market will resolve to \"Yes\" if Bad Bunny performs live and in person during the Super Bowl LX halftime show currently scheduled for February 8, 2026. Otherwise, this market will resolve to \"No.\"",
    },
    {
      question: "Will Cardi B perform during the Super Bowl LX halftime show?",
      displayLabel: "Cardi B",
      outcomes: ["Yes", "No"],
      seed0: 5368,
      seed1: 3730,
      detailsMarkdown: "This market will resolve to \"Yes\" if Cardi B performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Travis Scott perform during the Super Bowl LX halftime show?",
      displayLabel: "Travis Scott",
      outcomes: ["Yes", "No"],
      seed0: 2282,
      seed1: 9398,
      detailsMarkdown: "This market will resolve to \"Yes\" if Travis Scott performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Dua Lipa perform during the Super Bowl LX halftime show?",
      displayLabel: "Dua Lipa",
      outcomes: ["Yes", "No"],
      seed0: 3816,
      seed1: 16628,
      detailsMarkdown: "This market will resolve to \"Yes\" if Dua Lipa performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Post Malone perform during the Super Bowl LX halftime show?",
      displayLabel: "Post Malone",
      outcomes: ["Yes", "No"],
      seed0: 5120,
      seed1: 68110,
      detailsMarkdown: "This market will resolve to \"Yes\" if Post Malone performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Olivia Rodrigo perform during the Super Bowl LX halftime show?",
      displayLabel: "Olivia Rodrigo",
      outcomes: ["Yes", "No"],
      seed0: 3684,
      seed1: 75470,
      detailsMarkdown: "This market will resolve to \"Yes\" if Olivia Rodrigo performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Drake perform during the Super Bowl LX halftime show?",
      displayLabel: "Drake",
      outcomes: ["Yes", "No"],
      seed0: 4212,
      seed1: 84545,
      detailsMarkdown: "This market will resolve to \"Yes\" if Drake performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Miley Cyrus perform during the Super Bowl LX halftime show?",
      displayLabel: "Miley Cyrus",
      outcomes: ["Yes", "No"],
      seed0: 1980,
      seed1: 105087,
      detailsMarkdown: "This market will resolve to \"Yes\" if Miley Cyrus performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Metallica perform during the Super Bowl LX halftime show?",
      displayLabel: "Metallica",
      outcomes: ["Yes", "No"],
      seed0: 2170,
      seed1: 82857,
      detailsMarkdown: "This market will resolve to \"Yes\" if Metallica performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Sabrina Carpenter perform during the Super Bowl LX halftime show?",
      displayLabel: "Sabrina Carpenter",
      outcomes: ["Yes", "No"],
      seed0: 2428,
      seed1: 240272,
      detailsMarkdown: "This market will resolve to \"Yes\" if Sabrina Carpenter performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Green Day perform during the Super Bowl LX halftime show?",
      displayLabel: "Green Day",
      outcomes: ["Yes", "No"],
      seed0: 3643,
      seed1: 231857,
      detailsMarkdown: "This market will resolve to \"Yes\" if Green Day performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Charli XCX perform during the Super Bowl LX halftime show?",
      displayLabel: "Charli XCX",
      outcomes: ["Yes", "No"],
      seed0: 1992,
      seed1: 81008,
      detailsMarkdown: "This market will resolve to \"Yes\" if Charli XCX performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Taylor Swift perform during the Super Bowl LX halftime show?",
      displayLabel: "Taylor Swift",
      outcomes: ["Yes", "No"],
      seed0: 4471,
      seed1: 219029,
      detailsMarkdown: "This market will resolve to \"Yes\" if Taylor Swift performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will No Doubt perform during the Super Bowl LX halftime show?",
      displayLabel: "No Doubt",
      outcomes: ["Yes", "No"],
      seed0: 2556,
      seed1: 240744,
      detailsMarkdown: "This market will resolve to \"Yes\" if No Doubt performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Chappell Roan perform during the Super Bowl LX halftime show?",
      displayLabel: "Chappell Roan",
      outcomes: ["Yes", "No"],
      seed0: 2403,
      seed1: 226297,
      detailsMarkdown: "This market will resolve to \"Yes\" if Chappell Roan performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Justin Bieber perform during the Super Bowl LX halftime show?",
      displayLabel: "Justin Bieber",
      outcomes: ["Yes", "No"],
      seed0: 1795,
      seed1: 136205,
      detailsMarkdown: "This market will resolve to \"Yes\" if Justin Bieber performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Doechii perform during the Super Bowl LX halftime show?",
      displayLabel: "Doechii",
      outcomes: ["Yes", "No"],
      seed0: 2293,
      seed1: 40200,
      detailsMarkdown: "This market will resolve to \"Yes\" if Doechii performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Teddy Swims perform during the Super Bowl LX halftime show?",
      displayLabel: "Teddy Swims",
      outcomes: ["Yes", "No"],
      seed0: 1834,
      seed1: 50520,
      detailsMarkdown: "This market will resolve to \"Yes\" if Teddy Swims performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Christina Aguilera perform during the Super Bowl LX halftime show?",
      displayLabel: "Christina Aguilera",
      outcomes: ["Yes", "No"],
      seed0: 1312,
      seed1: 67756,
      detailsMarkdown: "This market will resolve to \"Yes\" if Christina Aguilera performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Adele perform during the Super Bowl LX halftime show?",
      displayLabel: "Adele",
      outcomes: ["Yes", "No"],
      seed0: 3052,
      seed1: 287748,
      detailsMarkdown: "This market will resolve to \"Yes\" if Adele performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Jay-Z perform during the Super Bowl LX halftime show?",
      displayLabel: "Jay-Z",
      outcomes: ["Yes", "No"],
      seed0: 3124,
      seed1: 237076,
      detailsMarkdown: "This market will resolve to \"Yes\" if Jay-Z performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Billie Eilish perform during the Super Bowl LX halftime show?",
      displayLabel: "Billie Eilish",
      outcomes: ["Yes", "No"],
      seed0: 2068,
      seed1: 227732,
      detailsMarkdown: "This market will resolve to \"Yes\" if Billie Eilish performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Ed Sheeran perform during the Super Bowl LX halftime show?",
      displayLabel: "Ed Sheeran",
      outcomes: ["Yes", "No"],
      seed0: 1829,
      seed1: 180971,
      detailsMarkdown: "This market will resolve to \"Yes\" if Ed Sheeran performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Harry Styles perform during the Super Bowl LX halftime show?",
      displayLabel: "Harry Styles",
      outcomes: ["Yes", "No"],
      seed0: 1868,
      seed1: 231932,
      detailsMarkdown: "This market will resolve to \"Yes\" if Harry Styles performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Gracie Abrams perform during the Super Bowl LX halftime show?",
      displayLabel: "Gracie Abrams",
      outcomes: ["Yes", "No"],
      seed0: 1876,
      seed1: 148124,
      detailsMarkdown: "This market will resolve to \"Yes\" if Gracie Abrams performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Pink perform during the Super Bowl LX halftime show?",
      displayLabel: "Pink",
      outcomes: ["Yes", "No"],
      seed0: 2976,
      seed1: 256024,
      detailsMarkdown: "This market will resolve to \"Yes\" if Pink performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Morgan Wallen perform during the Super Bowl LX halftime show?",
      displayLabel: "Morgan Wallen",
      outcomes: ["Yes", "No"],
      seed0: 2243,
      seed1: 233757,
      detailsMarkdown: "This market will resolve to \"Yes\" if Morgan Wallen performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Oasis perform during the Super Bowl LX halftime show?",
      displayLabel: "Oasis",
      outcomes: ["Yes", "No"],
      seed0: 1798,
      seed1: 169402,
      detailsMarkdown: "This market will resolve to \"Yes\" if Oasis performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Luke Combs perform during the Super Bowl LX halftime show?",
      displayLabel: "Luke Combs",
      outcomes: ["Yes", "No"],
      seed0: 2012,
      seed1: 307788,
      detailsMarkdown: "This market will resolve to \"Yes\" if Luke Combs performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Benson Boone perform during the Super Bowl LX halftime show?",
      displayLabel: "Benson Boone",
      outcomes: ["Yes", "No"],
      seed0: 1230,
      seed1: 49770,
      detailsMarkdown: "This market will resolve to \"Yes\" if Benson Boone performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will The Killers perform during the Super Bowl LX halftime show?",
      displayLabel: "The Killers",
      outcomes: ["Yes", "No"],
      seed0: 1689,
      seed1: 176111,
      detailsMarkdown: "This market will resolve to \"Yes\" if The Killers performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Foo Fighters perform during the Super Bowl LX halftime show?",
      displayLabel: "Foo Fighters",
      outcomes: ["Yes", "No"],
      seed0: 1273,
      seed1: 75827,
      detailsMarkdown: "This market will resolve to \"Yes\" if Foo Fighters performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Robbie Williams perform during the Super Bowl LX halftime show?",
      displayLabel: "Robbie Williams",
      outcomes: ["Yes", "No"],
      seed0: 1835,
      seed1: 260165,
      detailsMarkdown: "This market will resolve to \"Yes\" if Robbie Williams performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Elon Musk perform during the Super Bowl LX halftime show?",
      displayLabel: "Elon Musk",
      outcomes: ["Yes", "No"],
      seed0: 2783,
      seed1: 553217,
      detailsMarkdown: "This market will resolve to \"Yes\" if Elon Musk performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Joe Biden perform during the Super Bowl LX halftime show?",
      displayLabel: "Joe Biden",
      outcomes: ["Yes", "No"],
      seed0: 1569,
      seed1: 446431,
      detailsMarkdown: "This market will resolve to \"Yes\" if Joe Biden performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Erika Kirk perform during the Super Bowl LX halftime show?",
      displayLabel: "Erika Kirk",
      outcomes: ["Yes", "No"],
      seed0: 1257,
      seed1: 312743,
      detailsMarkdown: "This market will resolve to \"Yes\" if Erika Kirk performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Diddy perform during the Super Bowl LX halftime show?",
      displayLabel: "Diddy",
      outcomes: ["Yes", "No"],
      seed0: 2076,
      seed1: 828924,
      detailsMarkdown: "This market will resolve to \"Yes\" if Sean John Combs also known professionally as \"Diddy\" performs live and in person during the Super Bowl LX halftime show.",
    },
    {
      question: "Will Antonio Brown perform during the Super Bowl LX halftime show?",
      displayLabel: "Antonio Brown",
      outcomes: ["Yes", "No"],
      seed0: 314,
      seed1: 10173,
      detailsMarkdown: "This market will resolve to \"Yes\" if Antonio Brown performs live and in person during the Super Bowl LX halftime show.",
    },
  ];

  let halftimeMarketCount = 0;
  for (const marketData of halftimeMarkets) {
    const { outcomes, outcomeColors, ...marketFields } = marketData;
    
    const reserve0 = marketFields.seed0 || 5000;
    const reserve1 = marketFields.seed1 || 5000;
    const k = reserve0 * reserve1;
    
    const total = reserve0 + reserve1;
    const price0 = (reserve1 / total).toFixed(4);
    const price1 = (reserve0 / total).toFixed(4);
    
    const market = await prisma.market.create({
      data: {
        eventId: halftimeEvent.id,
        ...marketFields,
        closesAt: new Date("2026-02-09T00:00:00Z"),
        outcomes: JSON.stringify(outcomes),
        outcomePrices: JSON.stringify([price0, price1]),
        pricingModel: PricingModel.CPMM,
        reserve0,
        reserve1,
        k,
        status: MarketStatus.OPEN,
        publishedAt: new Date(),
        opensAt: new Date(),
      },
    });

    await prisma.priceSnapshot.create({
      data: {
        marketId: market.id,
        price0: parseFloat(price0),
        price1: parseFloat(price1),
        pool0: Math.floor(reserve0),
        pool1: Math.floor(reserve1),
      },
    });

    halftimeMarketCount++;
  }

  console.log(`   🎉 Created Super Bowl LX Halftime Show event with ${halftimeMarketCount} markets!\n`);

  // =========================================================================
  // SUPER BOWL LX VIEWERSHIP EVENT
  // =========================================================================
  console.log("   📺 Creating Super Bowl LX Viewership event...\n");

  const viewershipEvent = await prisma.event.create({
    data: {
      slug: "super-bowl-lx-viewership",
      title: "How many viewers will the Super Bowl have?",
      description: "This market will resolve according to the number of viewers (Persons 2+, average total viewers) Nielsen reports Super Bowl LX as having.\n\nIf this event is cancelled or otherwise does not occur by February 28, 2026, 11:59 PM ET, this market will resolve to the lowest bracket.\n\nIf the reported number of viewers falls exactly between two brackets, this market will resolve to the higher range bracket.\n\nThe resolution source will be information from Nielsen, specifically their Persons 2+ statistic.",
      category: MarketCategory.NFL,
      eventType: EventType.PROP,
      bannerUrl: "https://polymarket-upload.s3.us-east-2.amazonaws.com/how-many-viewers-will-the-super-bowl-have-k6hANnx_g4GC.jpg",
      logoUrl: "https://polymarket-upload.s3.us-east-2.amazonaws.com/how-many-viewers-will-the-super-bowl-have-k6hANnx_g4GC.jpg",
      startTime: new Date("2026-01-26T23:01:23.707336Z"),
      endTime: new Date("2026-02-08T00:00:00Z"),
      active: true,
      closed: false,
      tags: {
        connect: [
          { id: tags["nfl"].id },
          { id: tags["super-bowl"].id },
          { id: tags["sports"].id },
        ],
      },
    },
  });

  const viewershipMarkets = [
    {
      question: "Will Super Bowl LX have less than 116M viewers?",
      displayLabel: "< 116M",
      sortOrder: 0,
      outcomes: ["Yes", "No"],
      seed0: 8076,
      seed1: 207348,
      detailsMarkdown: "This market will resolve according to Nielsen's Persons 2+ statistic for Super Bowl LX viewership. Less than 116 million viewers.",
    },
    {
      question: "Will Super Bowl LX have between 116M and 120M viewers?",
      displayLabel: "116M - 120M",
      sortOrder: 1,
      outcomes: ["Yes", "No"],
      seed0: 2370,
      seed1: 50274,
      detailsMarkdown: "This market will resolve according to Nielsen's Persons 2+ statistic for Super Bowl LX viewership. Between 116 and 120 million viewers.",
    },
    {
      question: "Will Super Bowl LX have between 120M and 124M viewers?",
      displayLabel: "120M - 124M",
      sortOrder: 2,
      outcomes: ["Yes", "No"],
      seed0: 1496,
      seed1: 21518,
      detailsMarkdown: "This market will resolve according to Nielsen's Persons 2+ statistic for Super Bowl LX viewership. Between 120 and 124 million viewers.",
    },
    {
      question: "Will Super Bowl LX have between 124M and 128M viewers?",
      displayLabel: "124M - 128M",
      sortOrder: 3,
      outcomes: ["Yes", "No"],
      seed0: 1581,
      seed1: 5142,
      detailsMarkdown: "This market will resolve according to Nielsen's Persons 2+ statistic for Super Bowl LX viewership. Between 124 and 128 million viewers.",
    },
    {
      question: "Will Super Bowl LX have between 128M and 132M viewers?",
      displayLabel: "128M - 132M",
      sortOrder: 4,
      outcomes: ["Yes", "No"],
      seed0: 1645,
      seed1: 5664,
      detailsMarkdown: "This market will resolve according to Nielsen's Persons 2+ statistic for Super Bowl LX viewership. Between 128 and 132 million viewers.",
    },
    {
      question: "Will Super Bowl LX have between 132M and 136M viewers?",
      displayLabel: "132M - 136M",
      sortOrder: 5,
      outcomes: ["Yes", "No"],
      seed0: 2310,
      seed1: 12590,
      detailsMarkdown: "This market will resolve according to Nielsen's Persons 2+ statistic for Super Bowl LX viewership. Between 132 and 136 million viewers.",
    },
    {
      question: "Will Super Bowl LX have between 136M and 140M viewers?",
      displayLabel: "136M - 140M",
      sortOrder: 6,
      outcomes: ["Yes", "No"],
      seed0: 3144,
      seed1: 15354,
      detailsMarkdown: "This market will resolve according to Nielsen's Persons 2+ statistic for Super Bowl LX viewership. Between 136 and 140 million viewers.",
    },
    {
      question: "Will Super Bowl LX have at least 140M viewers?",
      displayLabel: "≥ 140M",
      sortOrder: 7,
      outcomes: ["Yes", "No"],
      seed0: 6995,
      seed1: 38150,
      detailsMarkdown: "This market will resolve according to Nielsen's Persons 2+ statistic for Super Bowl LX viewership. At least 140 million viewers.",
    },
  ];

  let viewershipMarketCount = 0;
  for (const marketData of viewershipMarkets) {
    const { outcomes, outcomeColors, ...marketFields } = marketData;
    
    const reserve0 = marketFields.seed0 || 5000;
    const reserve1 = marketFields.seed1 || 5000;
    const k = reserve0 * reserve1;
    
    const total = reserve0 + reserve1;
    const price0 = (reserve1 / total).toFixed(4);
    const price1 = (reserve0 / total).toFixed(4);
    
    const market = await prisma.market.create({
      data: {
        eventId: viewershipEvent.id,
        ...marketFields,
        closesAt: new Date("2026-02-08T00:00:00Z"),
        outcomes: JSON.stringify(outcomes),
        outcomePrices: JSON.stringify([price0, price1]),
        pricingModel: PricingModel.CPMM,
        reserve0,
        reserve1,
        k,
        status: MarketStatus.OPEN,
        publishedAt: new Date(),
        opensAt: new Date(),
      },
    });

    await prisma.priceSnapshot.create({
      data: {
        marketId: market.id,
        price0: parseFloat(price0),
        price1: parseFloat(price1),
        pool0: Math.floor(reserve0),
        pool1: Math.floor(reserve1),
      },
    });

    viewershipMarketCount++;
  }

  console.log(`   🎉 Created Super Bowl LX Viewership event with ${viewershipMarketCount} markets!\n`);
  
  // Summary
  const marketCount = await prisma.market.count();
  const eventCount = await prisma.event.count();
  const userCount = await prisma.user.count();
  console.log(`   📊 Total: ${eventCount} events, ${marketCount} markets, ${userCount} users`);
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
