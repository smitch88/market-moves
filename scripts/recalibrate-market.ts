import { PrismaClient } from "../packages/database/src/generated/client";

const prisma = new PrismaClient();

// AdminAction enum value
const AdminAction = { MARKET_UPDATE: "MARKET_UPDATE" } as const;

const MARKET_ID = "cml6tqp0f005hjr042u419rz3";
const ADMIN_USER_ID = "cml4bn6su000gfq5w8h5wdzib";

async function recalibrateMarket() {
  console.log("Fetching market data...");
  
  const market = await prisma.market.findUnique({
    where: { id: MARKET_ID },
    select: {
      id: true,
      question: true,
      status: true,
      seed0: true,
      seed1: true,
      pool0: true,
      pool1: true,
      reserve0: true,
      reserve1: true,
      k: true,
      outcomePrices: true,
    },
  });

  if (!market) {
    console.error("Market not found");
    return;
  }

  console.log("Market:", market.question);
  console.log("Status:", market.status);

  // Store old values
  const oldValues = {
    reserve0: Number(market.reserve0),
    reserve1: Number(market.reserve1),
    k: Number(market.k),
    outcomePrices: market.outcomePrices,
  };
  console.log("\nOLD VALUES:", oldValues);

  const seed0 = Number(market.seed0);
  const seed1 = Number(market.seed1);
  const pool0 = Number(market.pool0);
  const pool1 = Number(market.pool1);

  // Calculate POOL-WEIGHTED target prices
  const totalPool0 = seed0 + pool0;
  const totalPool1 = seed1 + pool1;
  const totalLiquidity = totalPool0 + totalPool1;

  console.log("\nPool totals:", { totalPool0, totalPool1, totalLiquidity });

  let targetPrice0 = totalPool0 / totalLiquidity;
  let targetPrice1 = totalPool1 / totalLiquidity;

  // Bound prices
  targetPrice0 = Math.max(0.01, Math.min(0.99, targetPrice0));
  targetPrice1 = Math.max(0.01, Math.min(0.99, targetPrice1));
  const priceSum = targetPrice0 + targetPrice1;
  targetPrice0 = targetPrice0 / priceSum;
  targetPrice1 = targetPrice1 / priceSum;

  console.log("Target prices:", { targetPrice0, targetPrice1 });

  // Calculate new reserves
  const targetK = seed0 * seed1;
  const ratio = targetPrice1 / targetPrice0;
  const newReserve1 = Math.sqrt(targetK / ratio);
  const newReserve0 = ratio * newReserve1;
  const newK = newReserve0 * newReserve1;
  const newPrice0 = newReserve1 / (newReserve0 + newReserve1);
  const newPrice1 = newReserve0 / (newReserve0 + newReserve1);

  console.log("\nNEW VALUES:", {
    reserve0: newReserve0,
    reserve1: newReserve1,
    k: newK,
    price0: newPrice0,
    price1: newPrice1,
  });

  // Fetch positions
  const positions = await prisma.position.findMany({
    where: { marketId: MARKET_ID },
    select: {
      id: true,
      userId: true,
      shares0: true,
      shares1: true,
      avgCost0: true,
      avgCost1: true,
    },
  });

  console.log(`\nFound ${positions.length} positions`);

  // Calculate adjustments
  interface PositionAdjustment {
    positionId: string;
    userId: string;
    oldShares0: number;
    oldShares1: number;
    newShares0: number;
    newShares1: number;
    costBasis0: number;
    costBasis1: number;
  }

  const positionAdjustments: PositionAdjustment[] = [];

  for (const position of positions) {
    const oldShares0 = Number(position.shares0);
    const oldShares1 = Number(position.shares1);
    const oldAvgCost0 = Number(position.avgCost0);
    const oldAvgCost1 = Number(position.avgCost1);

    const costBasis0 = oldShares0 * oldAvgCost0;
    const costBasis1 = oldShares1 * oldAvgCost1;

    const newShares0 = newPrice0 > 0 ? costBasis0 / newPrice0 : 0;
    const newShares1 = newPrice1 > 0 ? costBasis1 / newPrice1 : 0;

    if (oldShares0 > 0 || oldShares1 > 0) {
      positionAdjustments.push({
        positionId: position.id,
        userId: position.userId,
        oldShares0,
        oldShares1,
        newShares0,
        newShares1,
        costBasis0,
        costBasis1,
      });
    }
  }

  console.log(`Adjusting ${positionAdjustments.length} positions with shares`);

  // Run the transaction
  console.log("\nRunning transaction...");
  
  const result = await prisma.$transaction(async (tx) => {
    // 1. Update market
    const updated = await tx.market.update({
      where: { id: MARKET_ID },
      data: {
        reserve0: newReserve0,
        reserve1: newReserve1,
        k: newK,
        outcomePrices: JSON.stringify([
          newPrice0.toFixed(4),
          newPrice1.toFixed(4),
        ]),
      },
    });

    // 2. Bulk update positions
    if (positionAdjustments.length > 0) {
      const shares0Cases = positionAdjustments
        .map(adj => `WHEN id = '${adj.positionId}' THEN ${adj.newShares0.toFixed(6)}`)
        .join(' ');
      const shares1Cases = positionAdjustments
        .map(adj => `WHEN id = '${adj.positionId}' THEN ${adj.newShares1.toFixed(6)}`)
        .join(' ');
      const avgCost0Cases = positionAdjustments
        .map(adj => `WHEN id = '${adj.positionId}' THEN ${newPrice0.toFixed(6)}`)
        .join(' ');
      const avgCost1Cases = positionAdjustments
        .map(adj => `WHEN id = '${adj.positionId}' THEN ${newPrice1.toFixed(6)}`)
        .join(' ');
      
      const idList = positionAdjustments.map(adj => `'${adj.positionId}'`).join(',');
      
      await tx.$executeRawUnsafe(`
        UPDATE "Position"
        SET 
          shares0 = CASE ${shares0Cases} END,
          shares1 = CASE ${shares1Cases} END,
          "avgCost0" = CASE ${avgCost0Cases} END,
          "avgCost1" = CASE ${avgCost1Cases} END,
          "updatedAt" = NOW()
        WHERE id IN (${idList})
      `);
    }

    // 3. Log action
    await tx.adminActionLog.create({
      data: {
        adminUserId: ADMIN_USER_ID,
        action: AdminAction.MARKET_UPDATE,
        targetType: "Market",
        targetId: MARKET_ID,
        metadata: {
          action: "recalibrate",
          question: market.question,
          oldValues,
          newValues: {
            reserve0: newReserve0,
            reserve1: newReserve1,
            k: newK,
            prices: [newPrice0, newPrice1],
          },
          positionsAdjusted: positionAdjustments.length,
        },
      },
    });

    // 4. Price snapshot
    await tx.priceSnapshot.create({
      data: {
        marketId: MARKET_ID,
        price0: newPrice0,
        price1: newPrice1,
        pool0: Math.floor(totalPool0),
        pool1: Math.floor(totalPool1),
      },
    });

    return updated;
  }, {
    maxWait: 30000,
    timeout: 30000,
  });

  console.log("\n✅ Recalibration complete!");
  console.log("New market prices:", result.outcomePrices);
}

recalibrateMarket()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
