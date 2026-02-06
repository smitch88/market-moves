-- CreateTable: AutoMarketConfig for cron-created crypto Over/Under price markets
CREATE TABLE "AutoMarketConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenSymbol" TEXT NOT NULL,
    "tokenName" TEXT NOT NULL,
    "coingeckoId" TEXT NOT NULL,
    "chain" TEXT,
    "timeframeMinutes" INTEGER NOT NULL,
    "timeframeLabel" TEXT NOT NULL,
    "feeBps" INTEGER NOT NULL DEFAULT 100,
    "seed0" DECIMAL(19,2) NOT NULL DEFAULT 100000,
    "seed1" DECIMAL(19,2) NOT NULL DEFAULT 100000,
    "category" "MarketCategory" NOT NULL DEFAULT 'CRYPTO',
    "eventBannerUrl" TEXT,
    "eventLogoUrl" TEXT,
    "cronExpression" TEXT,
    "lastCreatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutoMarketConfig_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one config per token + timeframe
CREATE UNIQUE INDEX "AutoMarketConfig_tokenSymbol_timeframeMinutes_key" ON "AutoMarketConfig"("tokenSymbol", "timeframeMinutes");

-- Add auto-market fields to Market
ALTER TABLE "Market" ADD COLUMN "autoMarketConfigId" TEXT;
ALTER TABLE "Market" ADD COLUMN "openingPrice" DECIMAL(19,4);

-- Foreign key and index for Market -> AutoMarketConfig
ALTER TABLE "Market" ADD CONSTRAINT "Market_autoMarketConfigId_fkey" FOREIGN KEY ("autoMarketConfigId") REFERENCES "AutoMarketConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Market_autoMarketConfigId_idx" ON "Market"("autoMarketConfigId");
