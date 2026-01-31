-- Add streak tracking fields to User
ALTER TABLE "User" ADD COLUMN "currentStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "longestStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lastActiveDate" TIMESTAMP(3);

-- Add KOL/Creator status fields to User
ALTER TABLE "User" ADD COLUMN "isKOL" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "kolApprovedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "kolApprovedBy" TEXT;

-- Add Captain attribution fields to User
ALTER TABLE "User" ADD COLUMN "captainId" TEXT;

-- Create StreakBadge table
CREATE TABLE "StreakBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeType" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreakBadge_pkey" PRIMARY KEY ("id")
);

-- Create KOLBetNotification table
CREATE TABLE "KOLBetNotification" (
    "id" TEXT NOT NULL,
    "kolUserId" TEXT NOT NULL,
    "betId" TEXT NOT NULL,
    "marketId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "amount" DECIMAL(19,2) NOT NULL,
    "outcomeIndex" INTEGER NOT NULL,
    "outcomeLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KOLBetNotification_pkey" PRIMARY KEY ("id")
);

-- Create DailyKOLSnapshot table
CREATE TABLE "DailyKOLSnapshot" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kolUserId" TEXT NOT NULL,
    "followerPnL" DECIMAL(19,2) NOT NULL,
    "followerVolume" DECIMAL(19,2) NOT NULL,
    "followerCount" INTEGER NOT NULL,
    "xpBonusAwarded" INTEGER NOT NULL DEFAULT 0,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyKOLSnapshot_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on StreakBadge
CREATE UNIQUE INDEX "StreakBadge_userId_badgeType_key" ON "StreakBadge"("userId", "badgeType");

-- Create unique constraint on KOLBetNotification
CREATE UNIQUE INDEX "KOLBetNotification_betId_key" ON "KOLBetNotification"("betId");

-- Create unique constraint on DailyKOLSnapshot
CREATE UNIQUE INDEX "DailyKOLSnapshot_date_kolUserId_key" ON "DailyKOLSnapshot"("date", "kolUserId");

-- Create indexes for StreakBadge
CREATE INDEX "StreakBadge_userId_idx" ON "StreakBadge"("userId");
CREATE INDEX "StreakBadge_badgeType_idx" ON "StreakBadge"("badgeType");

-- Create indexes for KOLBetNotification
CREATE INDEX "KOLBetNotification_kolUserId_idx" ON "KOLBetNotification"("kolUserId");
CREATE INDEX "KOLBetNotification_marketId_idx" ON "KOLBetNotification"("marketId");
CREATE INDEX "KOLBetNotification_eventId_idx" ON "KOLBetNotification"("eventId");
CREATE INDEX "KOLBetNotification_createdAt_idx" ON "KOLBetNotification"("createdAt");
CREATE INDEX "KOLBetNotification_expiresAt_idx" ON "KOLBetNotification"("expiresAt");

-- Create indexes for DailyKOLSnapshot
CREATE INDEX "DailyKOLSnapshot_kolUserId_idx" ON "DailyKOLSnapshot"("kolUserId");
CREATE INDEX "DailyKOLSnapshot_date_idx" ON "DailyKOLSnapshot"("date");
CREATE INDEX "DailyKOLSnapshot_isWinner_idx" ON "DailyKOLSnapshot"("isWinner");

-- Create indexes for User
CREATE INDEX "User_isKOL_idx" ON "User"("isKOL");
CREATE INDEX "User_captainId_idx" ON "User"("captainId");

-- Add foreign key constraints
ALTER TABLE "User" ADD CONSTRAINT "User_captainId_fkey" FOREIGN KEY ("captainId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "StreakBadge" ADD CONSTRAINT "StreakBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KOLBetNotification" ADD CONSTRAINT "KOLBetNotification_kolUserId_fkey" FOREIGN KEY ("kolUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KOLBetNotification" ADD CONSTRAINT "KOLBetNotification_betId_fkey" FOREIGN KEY ("betId") REFERENCES "Bet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KOLBetNotification" ADD CONSTRAINT "KOLBetNotification_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "KOLBetNotification" ADD CONSTRAINT "KOLBetNotification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DailyKOLSnapshot" ADD CONSTRAINT "DailyKOLSnapshot_kolUserId_fkey" FOREIGN KEY ("kolUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
