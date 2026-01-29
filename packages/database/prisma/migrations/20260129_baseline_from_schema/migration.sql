-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'RESOLVED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('MATCHUP', 'PROP', 'TOURNAMENT', 'FUTURES');

-- CreateEnum
CREATE TYPE "MarketCategory" AS ENUM ('NFL', 'NBA', 'NHL', 'MLB', 'SOCCER', 'UFC', 'TENNIS', 'GOLF', 'ESPORTS', 'POLITICS', 'CRYPTO', 'FINANCE', 'ENTERTAINMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING_TWEET', 'CONFIRMED', 'WON', 'LOST', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BalanceReason" AS ENUM ('INITIAL_CREDIT', 'BET_PLACED', 'SETTLEMENT_PAYOUT', 'SETTLEMENT_LOSS', 'ADMIN_ADJUST', 'REFERRAL_BONUS', 'OTHER', 'TRADE_SELL');

-- CreateEnum
CREATE TYPE "PnLReason" AS ENUM ('TRADE_SELL', 'REDEMPTION', 'ADMIN_ADJUST', 'RECALCULATION');

-- CreateEnum
CREATE TYPE "TradeType" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "PricingModel" AS ENUM ('PARI_MUTUEL', 'CPMM');

-- CreateEnum
CREATE TYPE "RaffleReason" AS ENUM ('CORRECT_PREDICTION', 'REFERRAL_BONUS');

-- CreateEnum
CREATE TYPE "TweetProofMethod" AS ENUM ('TIMELINE_SCAN', 'TWEET_URL');

-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('MARKET_CREATE', 'MARKET_UPDATE', 'MARKET_CLOSE', 'MARKET_RESOLVE', 'MARKET_SETTLE', 'USER_ROLE_UPDATE', 'USER_UPDATE', 'USER_XP_ADJUST', 'CONFIG_UPDATE', 'EVENT_CREATE', 'EVENT_UPDATE');

-- CreateEnum
CREATE TYPE "XPReason" AS ENUM ('TRADE_VOLUME', 'ADMIN_ADJUST', 'BONUS', 'PENALTY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "privyUserId" TEXT NOT NULL,
    "email" TEXT,
    "walletAddress" TEXT,
    "twitterSubject" TEXT,
    "handle" TEXT,
    "name" TEXT,
    "profileImageUrl" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "balance" DECIMAL(19,2) NOT NULL DEFAULT 10000.00,
    "balanceLocked" BOOLEAN NOT NULL DEFAULT false,
    "referralCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "realizedPnL" DECIMAL(19,4) NOT NULL DEFAULT 0.0000,
    "totalVolume" DECIMAL(19,2) NOT NULL DEFAULT 0.00,
    "xp" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" DECIMAL(19,2) NOT NULL,
    "balanceBefore" DECIMAL(19,2) NOT NULL,
    "balanceAfter" DECIMAL(19,2) NOT NULL,
    "reason" "BalanceReason" NOT NULL,
    "correlationId" TEXT,
    "actorAdminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPnLSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realizedPnL" DECIMAL(19,4) NOT NULL,
    "unrealizedPnL" DECIMAL(19,4) NOT NULL,
    "totalVolume" DECIMAL(19,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPnLSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XPLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "xpBefore" INTEGER NOT NULL,
    "xpAfter" INTEGER NOT NULL,
    "reason" "XPReason" NOT NULL,
    "correlationId" TEXT,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XPLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XPConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "XPConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PnLLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" DECIMAL(19,4) NOT NULL,
    "pnlBefore" DECIMAL(19,4) NOT NULL,
    "pnlAfter" DECIMAL(19,4) NOT NULL,
    "reason" "PnLReason" NOT NULL,
    "correlationId" TEXT,
    "marketId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PnLLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "MarketCategory" NOT NULL DEFAULT 'OTHER',
    "eventType" "EventType" NOT NULL DEFAULT 'MATCHUP',
    "bannerUrl" TEXT,
    "logoUrl" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "status" "MarketStatus" NOT NULL DEFAULT 'DRAFT',
    "detailsMarkdown" TEXT,
    "resolutionSourceUrl" TEXT,
    "publishedAt" TIMESTAMP(3),
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settlementRunId" TEXT,
    "feeBps" INTEGER NOT NULL DEFAULT 100,
    "seed0" DECIMAL(19,2) NOT NULL DEFAULT 1000.00,
    "seed1" DECIMAL(19,2) NOT NULL DEFAULT 1000.00,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "displayLabel" TEXT,
    "sortOrder" INTEGER,
    "outcomes" TEXT NOT NULL DEFAULT '["Yes", "No"]',
    "outcomePrices" TEXT NOT NULL DEFAULT '["0.50", "0.50"]',
    "outcomeColors" TEXT,
    "resolvedOutcome" INTEGER,
    "pool0" DECIMAL(19,2) NOT NULL DEFAULT 0.00,
    "pool1" DECIMAL(19,2) NOT NULL DEFAULT 0.00,
    "k" DECIMAL(38,4),
    "pricingModel" "PricingModel" NOT NULL DEFAULT 'CPMM',
    "reserve0" DECIMAL(19,2) NOT NULL DEFAULT 1000,
    "reserve1" DECIMAL(19,2) NOT NULL DEFAULT 1000,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceSnapshot" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "price0" DECIMAL(10,4) NOT NULL,
    "price1" DECIMAL(10,4) NOT NULL,
    "pool0" DECIMAL(19,2) NOT NULL,
    "pool1" DECIMAL(19,2) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "payout" DECIMAL(19,2),
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING_TWEET',
    "tweetProofId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "outcomeIndex" INTEGER NOT NULL,
    "pricePerShare" DECIMAL(10,4),
    "shares" DECIMAL(19,4),
    "tradeType" "TradeType" NOT NULL DEFAULT 'BUY',

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "amount0" DECIMAL(19,2) NOT NULL DEFAULT 0.00,
    "amount1" DECIMAL(19,2) NOT NULL DEFAULT 0.00,
    "weighted0" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weighted1" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastBetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "avgCost0" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "avgCost1" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "shares0" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "shares1" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL,
    "referrerUserId" TEXT NOT NULL,
    "referredUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "qualifiedAt" TIMESTAMP(3),
    "bonusEntriesAwarded" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaffleEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "entries" INTEGER NOT NULL DEFAULT 1,
    "reason" "RaffleReason" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RaffleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TweetProof" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "method" "TweetProofMethod" NOT NULL,
    "tweetUrl" TEXT,
    "tweetId" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "matchedText" TEXT,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "TweetProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminActionLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "action" "AdminAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminActionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_EventToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventToTag_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_privyUserId_key" ON "User"("privyUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_twitterSubject_idx" ON "User"("twitterSubject");

-- CreateIndex
CREATE INDEX "User_referralCode_idx" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_handle_idx" ON "User"("handle");

-- CreateIndex
CREATE INDEX "BalanceLedger_userId_idx" ON "BalanceLedger"("userId");

-- CreateIndex
CREATE INDEX "BalanceLedger_correlationId_idx" ON "BalanceLedger"("correlationId");

-- CreateIndex
CREATE INDEX "BalanceLedger_createdAt_idx" ON "BalanceLedger"("createdAt");

-- CreateIndex
CREATE INDEX "UserPnLSnapshot_userId_createdAt_idx" ON "UserPnLSnapshot"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "XPLedger_userId_idx" ON "XPLedger"("userId");

-- CreateIndex
CREATE INDEX "XPLedger_userId_createdAt_idx" ON "XPLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "XPLedger_createdAt_idx" ON "XPLedger"("createdAt");

-- CreateIndex
CREATE INDEX "XPLedger_reason_idx" ON "XPLedger"("reason");

-- CreateIndex
CREATE INDEX "XPLedger_correlationId_idx" ON "XPLedger"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "XPConfig_key_key" ON "XPConfig"("key");

-- CreateIndex
CREATE INDEX "PnLLedger_userId_idx" ON "PnLLedger"("userId");

-- CreateIndex
CREATE INDEX "PnLLedger_userId_createdAt_idx" ON "PnLLedger"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PnLLedger_createdAt_idx" ON "PnLLedger"("createdAt");

-- CreateIndex
CREATE INDEX "PnLLedger_reason_idx" ON "PnLLedger"("reason");

-- CreateIndex
CREATE INDEX "PnLLedger_correlationId_idx" ON "PnLLedger"("correlationId");

-- CreateIndex
CREATE INDEX "PnLLedger_marketId_idx" ON "PnLLedger"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- CreateIndex
CREATE INDEX "Event_category_idx" ON "Event"("category");

-- CreateIndex
CREATE INDEX "Event_eventType_idx" ON "Event"("eventType");

-- CreateIndex
CREATE INDEX "Event_active_idx" ON "Event"("active");

-- CreateIndex
CREATE INDEX "Event_closed_idx" ON "Event"("closed");

-- CreateIndex
CREATE INDEX "Event_startTime_idx" ON "Event"("startTime");

-- CreateIndex
CREATE INDEX "Event_featured_idx" ON "Event"("featured");

-- CreateIndex
CREATE UNIQUE INDEX "Market_settlementRunId_key" ON "Market"("settlementRunId");

-- CreateIndex
CREATE INDEX "Market_eventId_idx" ON "Market"("eventId");

-- CreateIndex
CREATE INDEX "Market_status_idx" ON "Market"("status");

-- CreateIndex
CREATE INDEX "Market_closesAt_idx" ON "Market"("closesAt");

-- CreateIndex
CREATE INDEX "Market_publishedAt_idx" ON "Market"("publishedAt");

-- CreateIndex
CREATE INDEX "Market_pricingModel_idx" ON "Market"("pricingModel");

-- CreateIndex
CREATE INDEX "PriceSnapshot_marketId_timestamp_idx" ON "PriceSnapshot"("marketId", "timestamp");

-- CreateIndex
CREATE INDEX "PriceSnapshot_timestamp_idx" ON "PriceSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");

-- CreateIndex
CREATE INDEX "Bet_marketId_idx" ON "Bet"("marketId");

-- CreateIndex
CREATE INDEX "Bet_outcomeIndex_idx" ON "Bet"("outcomeIndex");

-- CreateIndex
CREATE INDEX "Bet_status_idx" ON "Bet"("status");

-- CreateIndex
CREATE INDEX "Bet_createdAt_idx" ON "Bet"("createdAt");

-- CreateIndex
CREATE INDEX "Bet_tradeType_idx" ON "Bet"("tradeType");

-- CreateIndex
CREATE INDEX "Bet_userId_tradeType_status_idx" ON "Bet"("userId", "tradeType", "status");

-- CreateIndex
CREATE INDEX "Bet_userId_status_createdAt_idx" ON "Bet"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Position_userId_idx" ON "Position"("userId");

-- CreateIndex
CREATE INDEX "Position_marketId_idx" ON "Position"("marketId");

-- CreateIndex
CREATE INDEX "Position_userId_claimedAt_idx" ON "Position"("userId", "claimedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_marketId_key" ON "Position"("userId", "marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");

-- CreateIndex
CREATE INDEX "Referral_referrerUserId_idx" ON "Referral"("referrerUserId");

-- CreateIndex
CREATE INDEX "RaffleEntry_userId_idx" ON "RaffleEntry"("userId");

-- CreateIndex
CREATE INDEX "RaffleEntry_marketId_idx" ON "RaffleEntry"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_userId_marketId_reason_key" ON "RaffleEntry"("userId", "marketId", "reason");

-- CreateIndex
CREATE INDEX "TweetProof_userId_idx" ON "TweetProof"("userId");

-- CreateIndex
CREATE INDEX "TweetProof_marketId_idx" ON "TweetProof"("marketId");

-- CreateIndex
CREATE INDEX "TweetProof_verified_idx" ON "TweetProof"("verified");

-- CreateIndex
CREATE INDEX "AdminActionLog_adminUserId_idx" ON "AdminActionLog"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminActionLog_targetType_targetId_idx" ON "AdminActionLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");

-- CreateIndex
CREATE INDEX "_EventToTag_B_index" ON "_EventToTag"("B");

-- AddForeignKey
ALTER TABLE "BalanceLedger" ADD CONSTRAINT "BalanceLedger_actorAdminUserId_fkey" FOREIGN KEY ("actorAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceLedger" ADD CONSTRAINT "BalanceLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPnLSnapshot" ADD CONSTRAINT "UserPnLSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPLedger" ADD CONSTRAINT "XPLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XPLedger" ADD CONSTRAINT "XPLedger_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PnLLedger" ADD CONSTRAINT "PnLLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PnLLedger" ADD CONSTRAINT "PnLLedger_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceSnapshot" ADD CONSTRAINT "PriceSnapshot_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_tweetProofId_fkey" FOREIGN KEY ("tweetProofId") REFERENCES "TweetProof"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TweetProof" ADD CONSTRAINT "TweetProof_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TweetProof" ADD CONSTRAINT "TweetProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventToTag" ADD CONSTRAINT "_EventToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_EventToTag" ADD CONSTRAINT "_EventToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

