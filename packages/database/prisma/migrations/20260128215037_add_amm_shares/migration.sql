-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('PARI_MUTUEL', 'CPMM');

-- AlterEnum
ALTER TYPE "BalanceReason" ADD VALUE 'TRADE_SELL';

-- AlterTable: Add new columns to Bet
ALTER TABLE "Bet" ADD COLUMN     "pricePerShare" DOUBLE PRECISION,
ADD COLUMN     "shares" DOUBLE PRECISION,
ADD COLUMN     "tradeType" "TradeType" NOT NULL DEFAULT 'BUY';

-- AlterTable: Add new columns to Market
-- Note: Default is CPMM for new markets, but we'll update existing ones to PARI_MUTUEL
ALTER TABLE "Market" ADD COLUMN     "k" DOUBLE PRECISION,
ADD COLUMN     "pricingModel" "PricingModel" NOT NULL DEFAULT 'CPMM',
ADD COLUMN     "reserve0" DOUBLE PRECISION NOT NULL DEFAULT 1000,
ADD COLUMN     "reserve1" DOUBLE PRECISION NOT NULL DEFAULT 1000;

-- Backward compatibility: Mark all existing markets as PARI_MUTUEL
UPDATE "Market" SET "pricingModel" = 'PARI_MUTUEL';

-- AlterTable: Add new columns to Position
ALTER TABLE "Position" ADD COLUMN     "avgCost0" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "avgCost1" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shares0" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "shares1" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Bet_tradeType_idx" ON "Bet"("tradeType");

-- CreateIndex for pricingModel for efficient filtering
CREATE INDEX "Market_pricingModel_idx" ON "Market"("pricingModel");
