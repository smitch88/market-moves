import { PrismaClient, MarketStatus, BetStatus, TradeType, BalanceReason } from "../src/generated/client";
import { Prisma } from "../src/generated/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Setting up test settlement data...\n");

  // Get the vancampjochen user
  const testUser = await prisma.user.findFirst({
    where: {
      OR: [
        { handle: "vancampjochen" },
        { email: { contains: "jochen" } },
      ],
    },
  });

  if (!testUser) {
    throw new Error("vancampjochen user not found");
  }

  console.log(`Using test user: ${testUser.handle || testUser.email}`);

  // Get some markets to work with
  const markets = await prisma.market.findMany({
    where: {
      status: "OPEN",
      pricingModel: "CPMM",
    },
    take: 3,
  });

  if (markets.length < 3) {
    throw new Error("Need at least 3 markets");
  }

  console.log(`Found ${markets.length} markets\n`);

  // Market 1: Create a winning position, resolve, and settle
  const market1 = markets[0];
  console.log(`\n📊 Market 1: ${market1.question}`);
  
  // Create position for outcome 0 (which will win)
  await prisma.$transaction(async (tx) => {
    // Deduct balance
    const user = await tx.user.findUnique({ where: { id: testUser.id } });
    if (!user) throw new Error("User not found");
    
    const betAmount = new Prisma.Decimal("100.00");
    const shares = new Prisma.Decimal("150.00"); // Simulate getting 150 shares
    const avgPrice = new Prisma.Decimal("0.67");

    await tx.user.update({
      where: { id: testUser.id },
      data: { balance: { decrement: betAmount } },
    });

    // Create bet
    await tx.bet.create({
      data: {
        userId: testUser.id,
        marketId: market1.id,
        outcomeIndex: 0,
        tradeType: TradeType.BUY,
        amount: betAmount,
        shares: shares,
        pricePerShare: avgPrice,
        status: BetStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    // Create position
    await tx.position.upsert({
      where: {
        userId_marketId: {
          userId: testUser.id,
          marketId: market1.id,
        },
      },
      update: {
        shares0: { increment: shares },
        avgCost0: avgPrice,
        lastBetAt: new Date(),
      },
      create: {
        userId: testUser.id,
        marketId: market1.id,
        shares0: shares,
        avgCost0: avgPrice,
        lastBetAt: new Date(),
      },
    });
  });

  // Resolve to outcome 0 (winning)
  await prisma.market.update({
    where: { id: market1.id },
    data: {
      status: MarketStatus.RESOLVED,
      resolvedOutcome: 0,
      resolvedAt: new Date(),
    },
  });

  // Settle the market (payout winners)
  await prisma.$transaction(async (tx) => {
    const position = await tx.position.findUnique({
      where: {
        userId_marketId: {
          userId: testUser.id,
          marketId: market1.id,
        },
      },
    });

    if (position && position.shares0 > 0) {
      // Calculate payout (1 share = $1, minus 1% fee)
      const shares = Number(position.shares0);
      const payout = Math.floor(shares * 0.99); // 1% fee
      
      await tx.user.update({
        where: { id: testUser.id },
        data: { balance: { increment: payout } },
      });

      await tx.balanceLedger.create({
        data: {
          userId: testUser.id,
          delta: new Prisma.Decimal(payout),
          balanceBefore: testUser.balance,
          balanceAfter: new Prisma.Decimal(Number(testUser.balance) + payout),
          reason: "SETTLEMENT_PAYOUT",
          correlationId: market1.id,
        },
      });
    }

    await tx.market.update({
      where: { id: market1.id },
      data: { settledAt: new Date() },
    });
  });

  console.log(`✅ Won position (150 shares @ $0.67) - Payout: $148.50`);

  // Market 2: Create a losing position, resolve, and settle
  const market2 = markets[1];
  console.log(`\n📊 Market 2: ${market2.question}`);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: testUser.id } });
    if (!user) throw new Error("User not found");
    
    const betAmount = new Prisma.Decimal("75.00");
    const shares = new Prisma.Decimal("100.00");
    const avgPrice = new Prisma.Decimal("0.75");

    await tx.user.update({
      where: { id: testUser.id },
      data: { balance: { decrement: betAmount } },
    });

    await tx.bet.create({
      data: {
        userId: testUser.id,
        marketId: market2.id,
        outcomeIndex: 1,
        tradeType: TradeType.BUY,
        amount: betAmount,
        shares: shares,
        pricePerShare: avgPrice,
        status: BetStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    await tx.position.upsert({
      where: {
        userId_marketId: {
          userId: testUser.id,
          marketId: market2.id,
        },
      },
      update: {
        shares1: { increment: shares },
        avgCost1: avgPrice,
        lastBetAt: new Date(),
      },
      create: {
        userId: testUser.id,
        marketId: market2.id,
        shares1: shares,
        avgCost1: avgPrice,
        lastBetAt: new Date(),
      },
    });
  });

  // Resolve to outcome 0 (losing for us since we bet on 1)
  await prisma.market.update({
    where: { id: market2.id },
    data: {
      status: MarketStatus.RESOLVED,
      resolvedOutcome: 0,
      resolvedAt: new Date(),
      settledAt: new Date(),
    },
  });

  console.log(`❌ Lost position (100 shares @ $0.75) - Payout: $0.00`);

  // Market 3: Create an active position (not resolved)
  const market3 = markets[2];
  console.log(`\n📊 Market 3: ${market3.question}`);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: testUser.id } });
    if (!user) throw new Error("User not found");
    
    const betAmount = new Prisma.Decimal("50.00");
    const shares = new Prisma.Decimal("80.00");
    const avgPrice = new Prisma.Decimal("0.625");

    await tx.user.update({
      where: { id: testUser.id },
      data: { balance: { decrement: betAmount } },
    });

    await tx.bet.create({
      data: {
        userId: testUser.id,
        marketId: market3.id,
        outcomeIndex: 0,
        tradeType: TradeType.BUY,
        amount: betAmount,
        shares: shares,
        pricePerShare: avgPrice,
        status: BetStatus.CONFIRMED,
        confirmedAt: new Date(),
      },
    });

    await tx.position.upsert({
      where: {
        userId_marketId: {
          userId: testUser.id,
          marketId: market3.id,
        },
      },
      update: {
        shares0: { increment: shares },
        avgCost0: avgPrice,
        lastBetAt: new Date(),
      },
      create: {
        userId: testUser.id,
        marketId: market3.id,
        shares0: shares,
        avgCost0: avgPrice,
        lastBetAt: new Date(),
      },
    });
  });

  console.log(`🟢 Active position (80 shares @ $0.625) - Still open`);

  console.log("\n✅ Test data setup complete!");
  console.log("\nYou should now see:");
  console.log("  - 1 winning settled position (+$73.50 profit)");
  console.log("  - 1 losing settled position (-$75.00 loss)");
  console.log("  - 1 active position (can still trade)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
