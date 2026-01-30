-- CreateTable
CREATE TABLE "XPTradeTracker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "tradeCount" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "lastTradeAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XPTradeTracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XPDailyTotal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "totalXpEarned" INTEGER NOT NULL DEFAULT 0,
    "totalVolume" DECIMAL(20,2) NOT NULL DEFAULT 0,
    "tradesCount" INTEGER NOT NULL DEFAULT 0,
    "marketsTraded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "XPDailyTotal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XPTradeTracker_userId_date_idx" ON "XPTradeTracker"("userId", "date");

-- CreateIndex
CREATE INDEX "XPTradeTracker_marketId_idx" ON "XPTradeTracker"("marketId");

-- CreateIndex
CREATE INDEX "XPTradeTracker_lastTradeAt_idx" ON "XPTradeTracker"("lastTradeAt");

-- CreateIndex
CREATE UNIQUE INDEX "XPTradeTracker_userId_marketId_date_key" ON "XPTradeTracker"("userId", "marketId", "date");

-- CreateIndex
CREATE INDEX "XPDailyTotal_userId_idx" ON "XPDailyTotal"("userId");

-- CreateIndex
CREATE INDEX "XPDailyTotal_date_idx" ON "XPDailyTotal"("date");

-- CreateIndex
CREATE UNIQUE INDEX "XPDailyTotal_userId_date_key" ON "XPDailyTotal"("userId", "date");

-- AddForeignKey
ALTER TABLE "XPTradeTracker" ADD CONSTRAINT "XPTradeTracker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPTradeTracker" ADD CONSTRAINT "XPTradeTracker_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPDailyTotal" ADD CONSTRAINT "XPDailyTotal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
