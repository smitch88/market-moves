import { PrismaClient, MarketCategory, MarketStatus, UserRole } from "../src/generated/client";

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

  // Create tags
  console.log("🏷️  Creating tags...\n");
  const tagData = [
    { slug: "nfl", label: "NFL" },
    { slug: "nba", label: "NBA" },
    { slug: "ufc", label: "UFC" },
    { slug: "soccer", label: "Soccer" },
    { slug: "politics", label: "Politics" },
    { slug: "crypto", label: "Crypto" },
    { slug: "entertainment", label: "Entertainment" },
    { slug: "sports", label: "Sports" },
    { slug: "super-bowl", label: "Super Bowl" },
    { slug: "playoffs", label: "Playoffs" },
    { slug: "championship", label: "Championship" },
    { slug: "awards", label: "Awards" },
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
  console.log(`✅ Created ${tagData.length} tags\n`);

  // Define events with their markets (Polymarket-style structure)
  const events = [
    // ============ SUPER BOWL LIX ============
    {
      slug: "super-bowl-lix",
      title: "Super Bowl LIX",
      description: "The biggest game in American football. Super Bowl LIX takes place on February 9, 2025 at Caesars Superdome, New Orleans.",
      category: MarketCategory.NFL,
      bannerUrl: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=1200",
      logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a2/Super_Bowl_logo.svg",
      startTime: new Date("2025-02-09T18:30:00Z"),
      tags: ["nfl", "super-bowl", "sports", "championship"],
      markets: [
        {
          question: "Who will win Super Bowl LIX?",
          outcomes: ["Kansas City Chiefs", "Philadelphia Eagles"],
          outcomeColors: ["#E31837", "#004C54"],
          closesAt: new Date("2025-02-09T18:00:00Z"),
          seed0: 15000,
          seed1: 12000,
          detailsMarkdown: `# Super Bowl LIX Winner\n\nWho will hoist the Lombardi Trophy?\n\n## Key Info\n- **Date:** February 9, 2025\n- **Location:** Caesars Superdome, New Orleans\n- **Broadcast:** FOX`,
        },
        {
          question: "Will the Super Bowl MVP be a quarterback?",
          outcomes: ["Yes (QB)", "No (Other)"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-02-09T23:00:00Z"),
          seed0: 8000,
          seed1: 5000,
          detailsMarkdown: `Quarterbacks have won MVP in 32 of 58 Super Bowls. Will the trend continue?`,
        },
        {
          question: "Will the total points be over 49.5?",
          outcomes: ["Over 49.5", "Under 49.5"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-02-09T23:00:00Z"),
          seed0: 6000,
          seed1: 6500,
          detailsMarkdown: `The over/under for Super Bowl LIX is set at 49.5 points. Which way will it go?`,
        },
        {
          question: "Will Patrick Mahomes throw for 300+ yards?",
          outcomes: ["Yes (300+)", "No (Under 300)"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-02-09T23:00:00Z"),
          seed0: 4500,
          seed1: 5500,
          detailsMarkdown: `Patrick Mahomes' playoff passing performance. Will he hit 300 yards in the big game?`,
        },
      ],
    },

    // ============ NBA 2024-25 ============
    {
      slug: "nba-2024-25-season",
      title: "NBA 2024-25 Season",
      description: "The 2024-25 NBA season. Who will claim the Larry O'Brien Trophy and individual awards?",
      category: MarketCategory.NBA,
      bannerUrl: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200",
      logoUrl: "https://cdn.nba.com/logos/leagues/logo-nba.svg",
      tags: ["nba", "sports", "championship"],
      markets: [
        {
          question: "Who will win the 2025 NBA Finals?",
          outcomes: ["Boston Celtics", "Denver Nuggets"],
          outcomeColors: ["#007A33", "#0E2240"],
          closesAt: new Date("2025-06-15T00:00:00Z"),
          seed0: 20000,
          seed1: 18000,
          detailsMarkdown: `# 2025 NBA Finals\n\nWho will claim the Larry O'Brien Trophy this season?`,
        },
        {
          question: "Who will win the 2024-25 NBA MVP award?",
          outcomes: ["Luka Dončić", "Nikola Jokić"],
          outcomeColors: ["#00538C", "#0E2240"],
          closesAt: new Date("2025-04-15T00:00:00Z"),
          seed0: 12000,
          seed1: 10000,
          detailsMarkdown: `The race for the Most Valuable Player award. Will it be a repeat winner or a new face?`,
        },
        {
          question: "Will LeBron score 40,000 career points this season?",
          outcomes: ["Yes", "No"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-04-13T00:00:00Z"),
          seed0: 9000,
          seed1: 3000,
          detailsMarkdown: `LeBron James is approaching another historic milestone. Will he hit 40K this season?`,
        },
      ],
    },

    // ============ UFC ============
    {
      slug: "ufc-310",
      title: "UFC 310",
      description: "UFC 310 championship fight card.",
      category: MarketCategory.UFC,
      bannerUrl: "https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=1200",
      startTime: new Date("2025-03-15T04:00:00Z"),
      tags: ["ufc", "sports"],
      markets: [
        {
          question: "Who wins the UFC 310 main event?",
          outcomes: ["Champion", "Challenger"],
          outcomeColors: ["#FFD700", "#C0C0C0"],
          closesAt: new Date("2025-03-15T04:00:00Z"),
          seed0: 7000,
          seed1: 8000,
          detailsMarkdown: `# UFC 310\n\nThe championship is on the line. Who walks away with the belt?`,
        },
      ],
    },
    {
      slug: "jon-jones-2025",
      title: "Jon Jones in 2025",
      description: "Predictions about Jon Jones for 2025.",
      category: MarketCategory.UFC,
      tags: ["ufc", "sports"],
      markets: [
        {
          question: "Will Jon Jones retire in 2025?",
          outcomes: ["Yes", "No"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-12-31T23:59:00Z"),
          seed0: 4000,
          seed1: 8000,
          detailsMarkdown: `The GOAT debate continues. Will Jon Jones hang up the gloves this year?`,
        },
      ],
    },

    // ============ SOCCER ============
    {
      slug: "champions-league-2024-25",
      title: "UEFA Champions League 2024-25",
      description: "Europe's elite club competition. Who lifts the trophy?",
      category: MarketCategory.SOCCER,
      bannerUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200",
      tags: ["soccer", "sports", "championship"],
      markets: [
        {
          question: "Who will win the 2024-25 Champions League?",
          outcomes: ["Real Madrid", "Manchester City"],
          outcomeColors: ["#FEBE10", "#6CABDD"],
          closesAt: new Date("2025-05-31T21:00:00Z"),
          seed0: 15000,
          seed1: 14000,
          detailsMarkdown: `# Champions League Final\n\nEurope's elite club competition. Who lifts the trophy in Munich?`,
        },
      ],
    },
    {
      slug: "premier-league-2024-25",
      title: "Premier League 2024-25",
      description: "The race for the English top flight title.",
      category: MarketCategory.SOCCER,
      tags: ["soccer", "sports", "championship"],
      markets: [
        {
          question: "Who wins the Premier League title?",
          outcomes: ["Arsenal", "Manchester City"],
          outcomeColors: ["#EF0107", "#6CABDD"],
          closesAt: new Date("2025-05-25T16:00:00Z"),
          seed0: 11000,
          seed1: 13000,
          detailsMarkdown: `The race for the English top flight title. Who finishes on top?`,
        },
      ],
    },

    // ============ POLITICS ============
    {
      slug: "fed-march-2025",
      title: "Fed Rate Decision March 2025",
      description: "Federal Reserve FOMC meeting decisions for March 2025.",
      category: MarketCategory.POLITICS,
      bannerUrl: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=1200",
      startTime: new Date("2025-03-19T18:00:00Z"),
      tags: ["politics"],
      markets: [
        {
          question: "Will the Fed cut rates in March 2025?",
          outcomes: ["Rate Cut", "No Cut"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-03-19T18:00:00Z"),
          seed0: 6000,
          seed1: 9000,
          detailsMarkdown: `# Federal Reserve Decision\n\nThe FOMC meeting in March could signal the start of rate cuts. What will they decide?`,
        },
      ],
    },
    {
      slug: "uk-election-2025",
      title: "UK Election 2025",
      description: "Predictions about UK general election timing.",
      category: MarketCategory.POLITICS,
      tags: ["politics"],
      markets: [
        {
          question: "Will there be a UK general election before July 2025?",
          outcomes: ["Yes", "No"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-07-01T00:00:00Z"),
          seed0: 3500,
          seed1: 5500,
          detailsMarkdown: `Speculation mounts about the timing of the next UK general election.`,
        },
      ],
    },

    // ============ CRYPTO ============
    {
      slug: "bitcoin-2025",
      title: "Bitcoin in 2025",
      description: "Bitcoin price predictions for 2025.",
      category: MarketCategory.CRYPTO,
      bannerUrl: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=1200",
      logoUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
      tags: ["crypto"],
      markets: [
        {
          question: "Will Bitcoin reach $100,000 by end of Q1 2025?",
          outcomes: ["Yes ($100K+)", "No"],
          outcomeColors: ["#F7931A", "#EF4444"],
          closesAt: new Date("2025-03-31T23:59:00Z"),
          seed0: 18000,
          seed1: 12000,
          detailsMarkdown: `# Bitcoin Price Target\n\nThe king of crypto eyes the $100K milestone. Will Q1 2025 be the breakthrough?`,
        },
      ],
    },
    {
      slug: "ethereum-2025",
      title: "Ethereum in 2025",
      description: "Ethereum predictions for 2025.",
      category: MarketCategory.CRYPTO,
      logoUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
      tags: ["crypto"],
      markets: [
        {
          question: "Will spot ETH ETF be approved by SEC in 2025?",
          outcomes: ["Approved", "Not Approved"],
          outcomeColors: ["#627EEA", "#EF4444"],
          closesAt: new Date("2025-12-31T23:59:00Z"),
          seed0: 14000,
          seed1: 8000,
          detailsMarkdown: `Following Bitcoin ETF approvals, will Ethereum get the same treatment?`,
        },
      ],
    },
    {
      slug: "solana-vs-ethereum",
      title: "Solana vs Ethereum",
      description: "The flippening debate: Can Solana overtake Ethereum?",
      category: MarketCategory.CRYPTO,
      tags: ["crypto"],
      markets: [
        {
          question: "Will Solana's market cap exceed Ethereum's in 2025?",
          outcomes: ["Yes (SOL > ETH)", "No"],
          outcomeColors: ["#9945FF", "#627EEA"],
          closesAt: new Date("2025-12-31T23:59:00Z"),
          seed0: 3000,
          seed1: 15000,
          detailsMarkdown: `The flippening debate extends beyond Bitcoin. Can Solana overtake Ethereum?`,
        },
      ],
    },

    // ============ ENTERTAINMENT ============
    {
      slug: "oscars-2025",
      title: "97th Academy Awards",
      description: "The 2025 Oscars ceremony.",
      category: MarketCategory.ENTERTAINMENT,
      bannerUrl: "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1200",
      startTime: new Date("2025-03-02T04:00:00Z"),
      tags: ["entertainment", "awards"],
      markets: [
        {
          question: "Will 'Oppenheimer' win Best Picture?",
          outcomes: ["Oppenheimer Wins", "Other Film Wins"],
          outcomeColors: ["#FFD700", "#C0C0C0"],
          closesAt: new Date("2025-03-02T04:00:00Z"),
          seed0: 11000,
          seed1: 5000,
          detailsMarkdown: `# 97th Academy Awards\n\nThe race for Hollywood's top prize. Will Nolan finally get his due?`,
        },
      ],
    },
    {
      slug: "grammys-2025",
      title: "67th Grammy Awards",
      description: "The 2025 Grammy Awards ceremony.",
      category: MarketCategory.ENTERTAINMENT,
      startTime: new Date("2025-02-02T04:00:00Z"),
      tags: ["entertainment", "awards"],
      markets: [
        {
          question: "Will Taylor Swift win Album of the Year again?",
          outcomes: ["Yes", "No"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-02-02T04:00:00Z"),
          seed0: 7000,
          seed1: 6000,
          detailsMarkdown: `Taylor Swift could make history with another Album of the Year win. Will she do it?`,
        },
      ],
    },
    {
      slug: "gta-6-release",
      title: "GTA 6 Release",
      description: "Grand Theft Auto VI release predictions.",
      category: MarketCategory.ENTERTAINMENT,
      bannerUrl: "https://images.unsplash.com/photo-1493711662062-fa541f7f1f9a?w=1200",
      tags: ["entertainment"],
      markets: [
        {
          question: "Will GTA 6 release in 2025?",
          outcomes: ["Releases 2025", "Delayed"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-12-31T23:59:00Z"),
          seed0: 8000,
          seed1: 10000,
          detailsMarkdown: `# Grand Theft Auto VI\n\nThe most anticipated game in history. Will Rockstar hit their 2025 target?`,
        },
      ],
    },

    // ============ OTHER ============
    {
      slug: "spacex-starship-2025",
      title: "SpaceX Starship 2025",
      description: "SpaceX Starship milestones for 2025.",
      category: MarketCategory.OTHER,
      bannerUrl: "https://images.unsplash.com/photo-1516849841032-87cbac4d88f7?w=1200",
      tags: [],
      markets: [
        {
          question: "Will Starship complete a full orbital flight in Q1 2025?",
          outcomes: ["Yes", "No"],
          outcomeColors: ["#22C55E", "#EF4444"],
          closesAt: new Date("2025-03-31T23:59:00Z"),
          seed0: 9000,
          seed1: 7000,
          detailsMarkdown: `# SpaceX Starship\n\nThe world's most powerful rocket. Will it achieve full orbit by end of Q1?`,
        },
      ],
    },
  ];

  // Create events and markets
  console.log("📈 Creating events and markets...\n");
  
  let totalMarkets = 0;
  
  for (const eventData of events) {
    const { markets: marketsData, tags: tagSlugs, ...eventFields } = eventData;
    
    // Get tag IDs
    const tagConnections = tagSlugs
      .filter((slug) => tags[slug])
      .map((slug) => ({ id: tags[slug].id }));

    // Create or update event
    const event = await prisma.event.upsert({
      where: { slug: eventData.slug },
      update: {
        ...eventFields,
        tags: { set: tagConnections },
      },
      create: {
        ...eventFields,
        tags: { connect: tagConnections },
      },
    });

    // Create markets for this event
    // First, check if markets already exist for this event
    const existingMarkets = await prisma.market.findMany({
      where: { eventId: event.id },
      select: { question: true },
    });
    const existingQuestions = new Set(existingMarkets.map((m) => m.question));

    for (const marketData of marketsData) {
      const { outcomes, outcomeColors, ...marketFields } = marketData;
      
      // Skip if market already exists
      if (existingQuestions.has(marketData.question)) {
        totalMarkets++;
        continue;
      }
      
      const market = await prisma.market.create({
        data: {
          eventId: event.id,
          ...marketFields,
          outcomes: JSON.stringify(outcomes),
          outcomePrices: JSON.stringify(["0.50", "0.50"]), // Start at 50/50
          outcomeColors: outcomeColors ? JSON.stringify(outcomeColors) : null,
          status: MarketStatus.OPEN,
          publishedAt: new Date(),
          opensAt: new Date(),
        },
      });

      // Create initial price snapshot for chart history
      // Calculate initial prices from seed values
      const totalSeeds = market.seed0 + market.seed1;
      const initialPrice0 = totalSeeds > 0 ? market.seed0 / totalSeeds : 0.5;
      const initialPrice1 = totalSeeds > 0 ? market.seed1 / totalSeeds : 0.5;
      
      await prisma.priceSnapshot.create({
        data: {
          marketId: market.id,
          price0: initialPrice0,
          price1: initialPrice1,
          pool0: market.seed0,
          pool1: market.seed1,
        },
      });
      
      totalMarkets++;
    }

    console.log(`  ✅ ${event.category}: ${event.title} (${marketsData.length} markets)`);
  }

  console.log(`\n🎉 Seeded ${events.length} events with ${totalMarkets} markets successfully!`);
  
  // Summary
  const eventCounts = await prisma.event.groupBy({
    by: ["category"],
    _count: true,
  });
  
  console.log("\n📊 Events by category:");
  for (const { category, _count } of eventCounts) {
    console.log(`   ${category}: ${_count}`);
  }
  
  const marketCount = await prisma.market.count();
  console.log(`\n📊 Total markets: ${marketCount}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
