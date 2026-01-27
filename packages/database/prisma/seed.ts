import { PrismaClient, MarketCategory, MarketStatus, OutcomeKey, UserRole } from "../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // Create admin user
  const admin = await prisma.user.upsert({
    where: { privyUserId: "admin-seed-user" },
    update: {},
    create: {
      privyUserId: "admin-seed-user",
      handle: "vault_admin",
      name: "Vault Admin",
      role: UserRole.ADMIN,
      balance: 100000,
    },
  });
  console.log("✅ Created admin user:", admin.handle);

  // Create test users
  const testUsers = await Promise.all([
    prisma.user.upsert({
      where: { privyUserId: "test-user-1" },
      update: {},
      create: {
        privyUserId: "test-user-1",
        handle: "crypto_whale",
        name: "Crypto Whale",
        balance: 50000,
      },
    }),
    prisma.user.upsert({
      where: { privyUserId: "test-user-2" },
      update: {},
      create: {
        privyUserId: "test-user-2",
        handle: "sports_guru",
        name: "Sports Guru",
        balance: 25000,
      },
    }),
    prisma.user.upsert({
      where: { privyUserId: "test-user-3" },
      update: {},
      create: {
        privyUserId: "test-user-3",
        handle: "market_maker",
        name: "Market Maker",
        balance: 75000,
      },
    }),
  ]);
  console.log(`✅ Created ${testUsers.length} test users\n`);

  // Define markets
  const markets = [
    // ============ NFL / SUPER BOWL ============
    {
      slug: "super-bowl-lix-winner",
      title: "Super Bowl LIX Winner",
      question: "Who will win Super Bowl LIX?",
      category: MarketCategory.NFL,
      status: MarketStatus.OPEN,
      bannerUrl: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200",
      logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a2/Super_Bowl_logo.svg",
      detailsMarkdown: `# Super Bowl LIX\n\nThe biggest game in American football. Who will hoist the Lombardi Trophy?\n\n## Key Info\n- **Date:** February 9, 2025\n- **Location:** Caesars Superdome, New Orleans\n- **Broadcast:** FOX`,
      closesAt: new Date("2025-02-09T18:00:00Z"),
      seedA: 15000,
      seedB: 12000,
      outcomes: [
        { key: OutcomeKey.A, label: "Kansas City Chiefs", color: "#E31837" },
        { key: OutcomeKey.B, label: "Philadelphia Eagles", color: "#004C54" },
      ],
    },
    {
      slug: "super-bowl-mvp",
      title: "Super Bowl LIX MVP",
      question: "Will the Super Bowl MVP be a quarterback?",
      category: MarketCategory.NFL,
      status: MarketStatus.OPEN,
      logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a2/Super_Bowl_logo.svg",
      detailsMarkdown: `Quarterbacks have won MVP in 32 of 58 Super Bowls. Will the trend continue?`,
      closesAt: new Date("2025-02-09T23:00:00Z"),
      seedA: 8000,
      seedB: 5000,
      outcomes: [
        { key: OutcomeKey.A, label: "Yes (QB)", color: "#22C55E" },
        { key: OutcomeKey.B, label: "No (Other)", color: "#EF4444" },
      ],
    },
    {
      slug: "super-bowl-total-points",
      title: "Super Bowl Total Points Over/Under",
      question: "Will the total points be over 49.5?",
      category: MarketCategory.NFL,
      status: MarketStatus.OPEN,
      detailsMarkdown: `The over/under for Super Bowl LIX is set at 49.5 points. Which way will it go?`,
      closesAt: new Date("2025-02-09T23:00:00Z"),
      seedA: 6000,
      seedB: 6500,
      outcomes: [
        { key: OutcomeKey.A, label: "Over 49.5", color: "#22C55E" },
        { key: OutcomeKey.B, label: "Under 49.5", color: "#EF4444" },
      ],
    },
    {
      slug: "mahomes-passing-yards",
      title: "Mahomes Passing Yards",
      question: "Will Patrick Mahomes throw for 300+ yards?",
      category: MarketCategory.NFL,
      status: MarketStatus.OPEN,
      detailsMarkdown: `Patrick Mahomes' playoff passing performance. Will he hit 300 yards in the big game?`,
      closesAt: new Date("2025-02-09T23:00:00Z"),
      seedA: 4500,
      seedB: 5500,
      outcomes: [
        { key: OutcomeKey.A, label: "Yes (300+)", color: "#22C55E" },
        { key: OutcomeKey.B, label: "No (Under 300)", color: "#EF4444" },
      ],
    },

    // ============ NBA ============
    {
      slug: "nba-championship-2025",
      title: "2025 NBA Championship",
      question: "Who will win the 2025 NBA Finals?",
      category: MarketCategory.NBA,
      status: MarketStatus.OPEN,
      bannerUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200",
      logoUrl: "https://cdn.nba.com/logos/leagues/logo-nba.svg",
      detailsMarkdown: `# 2025 NBA Finals\n\nWho will claim the Larry O'Brien Trophy this season?`,
      closesAt: new Date("2025-06-15T00:00:00Z"),
      seedA: 20000,
      seedB: 18000,
      outcomes: [
        { key: OutcomeKey.A, label: "Boston Celtics", color: "#007A33" },
        { key: OutcomeKey.B, label: "Denver Nuggets", color: "#0E2240" },
      ],
    },
    {
      slug: "nba-mvp-2025",
      title: "2024-25 NBA MVP",
      question: "Who will win the 2024-25 NBA MVP award?",
      category: MarketCategory.NBA,
      status: MarketStatus.OPEN,
      detailsMarkdown: `The race for the Most Valuable Player award. Will it be a repeat winner or a new face?`,
      closesAt: new Date("2025-04-15T00:00:00Z"),
      seedA: 12000,
      seedB: 10000,
      outcomes: [
        { key: OutcomeKey.A, label: "Luka Dončić", color: "#00538C" },
        { key: OutcomeKey.B, label: "Nikola Jokić", color: "#0E2240" },
      ],
    },
    {
      slug: "lebron-scoring-record",
      title: "LeBron's Scoring Record",
      question: "Will LeBron score 40,000 career points this season?",
      category: MarketCategory.NBA,
      status: MarketStatus.OPEN,
      detailsMarkdown: `LeBron James is approaching another historic milestone. Will he hit 40K this season?`,
      closesAt: new Date("2025-04-13T00:00:00Z"),
      seedA: 9000,
      seedB: 3000,
      outcomes: [
        { key: OutcomeKey.A, label: "Yes", color: "#22C55E" },
        { key: OutcomeKey.B, label: "No", color: "#EF4444" },
      ],
    },

    // ============ UFC / MMA ============
    {
      slug: "ufc-310-main-event",
      title: "UFC 310 Main Event",
      question: "Who wins the UFC 310 main event?",
      category: MarketCategory.UFC,
      status: MarketStatus.OPEN,
      bannerUrl: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=1200",
      detailsMarkdown: `# UFC 310\n\nThe championship is on the line. Who walks away with the belt?`,
      closesAt: new Date("2025-03-15T04:00:00Z"),
      seedA: 7000,
      seedB: 8000,
      outcomes: [
        { key: OutcomeKey.A, label: "Champion", color: "#FFD700" },
        { key: OutcomeKey.B, label: "Challenger", color: "#C0C0C0" },
      ],
    },
    {
      slug: "jones-retirement",
      title: "Jon Jones Retirement",
      question: "Will Jon Jones retire in 2025?",
      category: MarketCategory.UFC,
      status: MarketStatus.OPEN,
      detailsMarkdown: `The GOAT debate continues. Will Jon Jones hang up the gloves this year?`,
      closesAt: new Date("2025-12-31T23:59:00Z"),
      seedA: 4000,
      seedB: 8000,
      outcomes: [
        { key: OutcomeKey.A, label: "Yes", color: "#22C55E" },
        { key: OutcomeKey.B, label: "No", color: "#EF4444" },
      ],
    },

    // ============ SOCCER ============
    {
      slug: "champions-league-2025",
      title: "UEFA Champions League 2025",
      question: "Who will win the 2024-25 Champions League?",
      category: MarketCategory.SOCCER,
      status: MarketStatus.OPEN,
      bannerUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200",
      detailsMarkdown: `# Champions League Final\n\nEurope's elite club competition. Who lifts the trophy in Munich?`,
      closesAt: new Date("2025-05-31T21:00:00Z"),
      seedA: 15000,
      seedB: 14000,
      outcomes: [
        { key: OutcomeKey.A, label: "Real Madrid", color: "#FEBE10" },
        { key: OutcomeKey.B, label: "Manchester City", color: "#6CABDD" },
      ],
    },
    {
      slug: "premier-league-title",
      title: "Premier League 2024-25",
      question: "Who wins the Premier League title?",
      category: MarketCategory.SOCCER,
      status: MarketStatus.OPEN,
      detailsMarkdown: `The race for the English top flight title. Who finishes on top?`,
      closesAt: new Date("2025-05-25T16:00:00Z"),
      seedA: 11000,
      seedB: 13000,
      outcomes: [
        { key: OutcomeKey.A, label: "Arsenal", color: "#EF0107" },
        { key: OutcomeKey.B, label: "Manchester City", color: "#6CABDD" },
      ],
    },

    // ============ POLITICS ============
    {
      slug: "fed-rate-march-2025",
      title: "Fed Rate Decision March 2025",
      question: "Will the Fed cut rates in March 2025?",
      category: MarketCategory.POLITICS,
      status: MarketStatus.OPEN,
      bannerUrl: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200",
      detailsMarkdown: `# Federal Reserve Decision\n\nThe FOMC meeting in March could signal the start of rate cuts. What will they decide?`,
      closesAt: new Date("2025-03-19T18:00:00Z"),
      seedA: 6000,
      seedB: 9000,
      outcomes: [
        { key: OutcomeKey.A, label: "Rate Cut", color: "#22C55E" },
        { key: OutcomeKey.B, label: "No Cut", color: "#EF4444" },
      ],
    },
    {
      slug: "uk-general-election-timing",
      title: "UK Election Timing",
      question: "Will there be a UK general election before July 2025?",
      category: MarketCategory.POLITICS,
      status: MarketStatus.OPEN,
      detailsMarkdown: `Speculation mounts about the timing of the next UK general election.`,
      closesAt: new Date("2025-07-01T00:00:00Z"),
      seedA: 3500,
      seedB: 5500,
      outcomes: [
        { key: OutcomeKey.A, label: "Yes", color: "#22C55E" },
        { key: OutcomeKey.B, label: "No", color: "#EF4444" },
      ],
    },

    // ============ CRYPTO ============
    {
      slug: "btc-100k-q1-2025",
      title: "Bitcoin $100K in Q1 2025",
      question: "Will Bitcoin reach $100,000 by end of Q1 2025?",
      category: MarketCategory.CRYPTO,
      status: MarketStatus.OPEN,
      bannerUrl: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=1200",
      logoUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
      detailsMarkdown: `# Bitcoin Price Target\n\nThe king of crypto eyes the $100K milestone. Will Q1 2025 be the breakthrough?`,
      closesAt: new Date("2025-03-31T23:59:00Z"),
      seedA: 18000,
      seedB: 12000,
      outcomes: [
        { key: OutcomeKey.A, label: "Yes ($100K+)", color: "#F7931A" },
        { key: OutcomeKey.B, label: "No", color: "#EF4444" },
      ],
    },
    {
      slug: "eth-etf-approval",
      title: "Ethereum ETF Approval",
      question: "Will spot ETH ETF be approved by SEC in 2025?",
      category: MarketCategory.CRYPTO,
      status: MarketStatus.OPEN,
      logoUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
      detailsMarkdown: `Following Bitcoin ETF approvals, will Ethereum get the same treatment?`,
      closesAt: new Date("2025-12-31T23:59:00Z"),
      seedA: 14000,
      seedB: 8000,
      outcomes: [
        { key: OutcomeKey.A, label: "Approved", color: "#627EEA" },
        { key: OutcomeKey.B, label: "Not Approved", color: "#EF4444" },
      ],
    },
    {
      slug: "solana-flip-eth",
      title: "Solana Flips Ethereum",
      question: "Will Solana's market cap exceed Ethereum's in 2025?",
      category: MarketCategory.CRYPTO,
      status: MarketStatus.OPEN,
      detailsMarkdown: `The flippening debate extends beyond Bitcoin. Can Solana overtake Ethereum?`,
      closesAt: new Date("2025-12-31T23:59:00Z"),
      seedA: 3000,
      seedB: 15000,
      outcomes: [
        { key: OutcomeKey.A, label: "Yes (SOL > ETH)", color: "#9945FF" },
        { key: OutcomeKey.B, label: "No", color: "#627EEA" },
      ],
    },

    // ============ ENTERTAINMENT ============
    {
      slug: "oscars-best-picture-2025",
      title: "Best Picture Oscar 2025",
      question: "Will 'Oppenheimer' win Best Picture?",
      category: MarketCategory.ENTERTAINMENT,
      status: MarketStatus.OPEN,
      bannerUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200",
      detailsMarkdown: `# 97th Academy Awards\n\nThe race for Hollywood's top prize. Will Nolan finally get his due?`,
      closesAt: new Date("2025-03-02T04:00:00Z"),
      seedA: 11000,
      seedB: 5000,
      outcomes: [
        { key: OutcomeKey.A, label: "Oppenheimer Wins", color: "#FFD700" },
        { key: OutcomeKey.B, label: "Other Film Wins", color: "#C0C0C0" },
      ],
    },
    {
      slug: "taylor-swift-grammys",
      title: "Taylor Swift Grammy Count",
      question: "Will Taylor Swift win Album of the Year again?",
      category: MarketCategory.ENTERTAINMENT,
      status: MarketStatus.OPEN,
      detailsMarkdown: `Taylor Swift could make history with another Album of the Year win. Will she do it?`,
      closesAt: new Date("2025-02-02T04:00:00Z"),
      seedA: 7000,
      seedB: 6000,
      outcomes: [
        { key: OutcomeKey.A, label: "Yes", color: "#22C55E" },
        { key: OutcomeKey.B, label: "No", color: "#EF4444" },
      ],
    },
    {
      slug: "gta-6-release-2025",
      title: "GTA 6 Release Date",
      question: "Will GTA 6 release in 2025?",
      category: MarketCategory.ENTERTAINMENT,
      status: MarketStatus.OPEN,
      bannerUrl: "https://images.unsplash.com/photo-1493711662062-fa541f7f1f9a?w=1200",
      detailsMarkdown: `# Grand Theft Auto VI\n\nThe most anticipated game in history. Will Rockstar hit their 2025 target?`,
      closesAt: new Date("2025-12-31T23:59:00Z"),
      seedA: 8000,
      seedB: 10000,
      outcomes: [
        { key: OutcomeKey.A, label: "Releases 2025", color: "#22C55E" },
        { key: OutcomeKey.B, label: "Delayed", color: "#EF4444" },
      ],
    },

    // ============ OTHER ============
    {
      slug: "spacex-starship-orbit",
      title: "SpaceX Starship Orbit",
      question: "Will Starship complete a full orbital flight in Q1 2025?",
      category: MarketCategory.OTHER,
      status: MarketStatus.OPEN,
      bannerUrl: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=1200",
      detailsMarkdown: `# SpaceX Starship\n\nThe world's most powerful rocket. Will it achieve full orbit by end of Q1?`,
      closesAt: new Date("2025-03-31T23:59:00Z"),
      seedA: 9000,
      seedB: 7000,
      outcomes: [
        { key: OutcomeKey.A, label: "Yes", color: "#22C55E" },
        { key: OutcomeKey.B, label: "No", color: "#EF4444" },
      ],
    },
  ];

  // Create markets
  console.log("📈 Creating markets...\n");
  
  for (const marketData of markets) {
    const { outcomes, ...data } = marketData;
    
    const market = await prisma.market.upsert({
      where: { slug: data.slug },
      update: {
        ...data,
        publishedAt: new Date(),
        opensAt: new Date(),
      },
      create: {
        ...data,
        publishedAt: new Date(),
        opensAt: new Date(),
      },
    });

    // Create outcomes
    for (const outcome of outcomes) {
      await prisma.outcome.upsert({
        where: {
          marketId_key: {
            marketId: market.id,
            key: outcome.key,
          },
        },
        update: outcome,
        create: {
          ...outcome,
          marketId: market.id,
        },
      });
    }

    console.log(`  ✅ ${market.category}: ${market.title}`);
  }

  console.log(`\n🎉 Seeded ${markets.length} markets successfully!`);
  
  // Summary
  const marketCounts = await prisma.market.groupBy({
    by: ["category"],
    _count: true,
  });
  
  console.log("\n📊 Markets by category:");
  for (const { category, _count } of marketCounts) {
    console.log(`   ${category}: ${_count}`);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
