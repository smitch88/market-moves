-- Baseline migration representing the original schema
-- This migration should be marked as applied if the database already exists
-- Run: prisma migrate resolve --applied 20260128000000_baseline

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'RESOLVED', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MarketCategory" AS ENUM ('NFL', 'NBA', 'NHL', 'MLB', 'SOCCER', 'UFC', 'TENNIS', 'GOLF', 'ESPORTS', 'POLITICS', 'CRYPTO', 'FINANCE', 'ENTERTAINMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "OutcomeKey" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('PENDING_TWEET', 'CONFIRMED', 'WON', 'LOST', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BalanceReason" AS ENUM ('INITIAL_CREDIT', 'BET_PLACED', 'SETTLEMENT_PAYOUT', 'SETTLEMENT_LOSS', 'ADMIN_ADJUST', 'REFERRAL_BONUS', 'OTHER');

-- CreateEnum
CREATE TYPE "RaffleReason" AS ENUM ('CORRECT_PREDICTION', 'REFERRAL_BONUS');

-- CreateEnum
CREATE TYPE "TweetProofMethod" AS ENUM ('TIMELINE_SCAN', 'TWEET_URL');

-- CreateEnum
CREATE TYPE "AdminAction" AS ENUM ('MARKET_CREATE', 'MARKET_UPDATE', 'MARKET_CLOSE', 'MARKET_RESOLVE', 'MARKET_SETTLE', 'USER_ROLE_UPDATE');

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
    "balance" INTEGER NOT NULL DEFAULT 10000,
    "balanceLocked" BOOLEAN NOT NULL DEFAULT false,
    "referralCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceBefore" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "reason" "BalanceReason" NOT NULL,
    "correlationId" TEXT,
    "actorAdminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT,
    "category" "MarketCategory" NOT NULL DEFAULT 'OTHER',
    "status" "MarketStatus" NOT NULL DEFAULT 'DRAFT',
    "bannerUrl" TEXT,
    "logoUrl" TEXT,
    "detailsMarkdown" TEXT,
    "resolutionSourceUrl" TEXT,
    "resolvedOutcomeId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "opensAt" TIMESTAMP(3),
    "closesAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "settlementRunId" TEXT,
    "feeBps" INTEGER NOT NULL DEFAULT 100,
    "seedA" INTEGER NOT NULL DEFAULT 1000,
    "seedB" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "key" "OutcomeKey" NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Outcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "payout" INTEGER,
    "status" "BetStatus" NOT NULL DEFAULT 'PENDING_TWEET',
    "tweetProofId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "amountOutcomeA" INTEGER NOT NULL DEFAULT 0,
    "amountOutcomeB" INTEGER NOT NULL DEFAULT 0,
    "weightedOutcomeA" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weightedOutcomeB" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastBetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

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

-- CreateIndex
CREATE UNIQUE INDEX "User_privyUserId_key" ON "User"("privyUserId");
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_twitterSubject_idx" ON "User"("twitterSubject");
CREATE INDEX "User_referralCode_idx" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "BalanceLedger_userId_idx" ON "BalanceLedger"("userId");
CREATE INDEX "BalanceLedger_correlationId_idx" ON "BalanceLedger"("correlationId");
CREATE INDEX "BalanceLedger_createdAt_idx" ON "BalanceLedger"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Market_slug_key" ON "Market"("slug");
CREATE UNIQUE INDEX "Market_settlementRunId_key" ON "Market"("settlementRunId");
CREATE INDEX "Market_status_idx" ON "Market"("status");
CREATE INDEX "Market_category_idx" ON "Market"("category");
CREATE INDEX "Market_closesAt_idx" ON "Market"("closesAt");
CREATE INDEX "Market_publishedAt_idx" ON "Market"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_marketId_key_key" ON "Outcome"("marketId", "key");
CREATE INDEX "Outcome_marketId_idx" ON "Outcome"("marketId");

-- CreateIndex
CREATE INDEX "Bet_userId_idx" ON "Bet"("userId");
CREATE INDEX "Bet_marketId_idx" ON "Bet"("marketId");
CREATE INDEX "Bet_outcomeId_idx" ON "Bet"("outcomeId");
CREATE INDEX "Bet_status_idx" ON "Bet"("status");
CREATE INDEX "Bet_createdAt_idx" ON "Bet"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Position_userId_marketId_key" ON "Position"("userId", "marketId");
CREATE INDEX "Position_userId_idx" ON "Position"("userId");
CREATE INDEX "Position_marketId_idx" ON "Position"("marketId");

-- CreateIndex
CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");
CREATE INDEX "Referral_referrerUserId_idx" ON "Referral"("referrerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "RaffleEntry_userId_marketId_reason_key" ON "RaffleEntry"("userId", "marketId", "reason");
CREATE INDEX "RaffleEntry_userId_idx" ON "RaffleEntry"("userId");
CREATE INDEX "RaffleEntry_marketId_idx" ON "RaffleEntry"("marketId");

-- CreateIndex
CREATE INDEX "TweetProof_userId_idx" ON "TweetProof"("userId");
CREATE INDEX "TweetProof_marketId_idx" ON "TweetProof"("marketId");
CREATE INDEX "TweetProof_verified_idx" ON "TweetProof"("verified");

-- CreateIndex
CREATE INDEX "AdminActionLog_adminUserId_idx" ON "AdminActionLog"("adminUserId");
CREATE INDEX "AdminActionLog_targetType_targetId_idx" ON "AdminActionLog"("targetType", "targetId");
CREATE INDEX "AdminActionLog_createdAt_idx" ON "AdminActionLog"("createdAt");

-- AddForeignKey
ALTER TABLE "BalanceLedger" ADD CONSTRAINT "BalanceLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BalanceLedger" ADD CONSTRAINT "BalanceLedger_actorAdminUserId_fkey" FOREIGN KEY ("actorAdminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_outcomeId_fkey" FOREIGN KEY ("outcomeId") REFERENCES "Outcome"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_tweetProofId_fkey" FOREIGN KEY ("tweetProofId") REFERENCES "TweetProof"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Position" ADD CONSTRAINT "Position_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referrerUserId_fkey" FOREIGN KEY ("referrerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Referral" ADD CONSTRAINT "Referral_referredUserId_fkey" FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RaffleEntry" ADD CONSTRAINT "RaffleEntry_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TweetProof" ADD CONSTRAINT "TweetProof_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TweetProof" ADD CONSTRAINT "TweetProof_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminActionLog" ADD CONSTRAINT "AdminActionLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
