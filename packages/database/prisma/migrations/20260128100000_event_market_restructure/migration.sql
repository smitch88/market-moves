-- Migration: Event/Market Restructure (Polymarket-style)
-- This migration transforms the schema from Market -> Outcome (1:many) 
-- to Event -> Market (1:many) with inline JSON outcomes

-- ============================================================================
-- STEP 1: Add new enum values
-- ============================================================================

-- Add new AdminAction values
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'EVENT_CREATE';
ALTER TYPE "AdminAction" ADD VALUE IF NOT EXISTS 'EVENT_UPDATE';

-- ============================================================================
-- STEP 2: Create new tables
-- ============================================================================

-- Create Tag table
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- Create Event table
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "MarketCategory" NOT NULL DEFAULT 'OTHER',
    "bannerUrl" TEXT,
    "logoUrl" TEXT,
    "startTime" TIMESTAMP(3),
    "endTime" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");
CREATE INDEX "Event_category_idx" ON "Event"("category");
CREATE INDEX "Event_active_idx" ON "Event"("active");
CREATE INDEX "Event_closed_idx" ON "Event"("closed");
CREATE INDEX "Event_startTime_idx" ON "Event"("startTime");

-- Create Event-Tag join table
CREATE TABLE "_EventToTag" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_EventToTag_AB_pkey" PRIMARY KEY ("A","B")
);

CREATE INDEX "_EventToTag_B_index" ON "_EventToTag"("B");

ALTER TABLE "_EventToTag" ADD CONSTRAINT "_EventToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_EventToTag" ADD CONSTRAINT "_EventToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================================
-- STEP 3: Add new columns to Market
-- ============================================================================

-- Add eventId column (nullable initially for migration)
ALTER TABLE "Market" ADD COLUMN "eventId" TEXT;

-- Add new outcome fields as JSON strings
ALTER TABLE "Market" ADD COLUMN "outcomes" TEXT NOT NULL DEFAULT '["Yes", "No"]';
ALTER TABLE "Market" ADD COLUMN "outcomePrices" TEXT NOT NULL DEFAULT '["0.50", "0.50"]';
ALTER TABLE "Market" ADD COLUMN "outcomeColors" TEXT;

-- Add resolved outcome as index (instead of outcomeId)
ALTER TABLE "Market" ADD COLUMN "resolvedOutcome" INTEGER;

-- Rename seed columns
ALTER TABLE "Market" RENAME COLUMN "seedA" TO "seed0";
ALTER TABLE "Market" RENAME COLUMN "seedB" TO "seed1";

-- Add pool tracking columns
ALTER TABLE "Market" ADD COLUMN "pool0" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Market" ADD COLUMN "pool1" INTEGER NOT NULL DEFAULT 0;

-- ============================================================================
-- STEP 4: Add new column to Bet
-- ============================================================================

-- Add outcomeIndex column (nullable initially for migration)
ALTER TABLE "Bet" ADD COLUMN "outcomeIndex" INTEGER;

-- ============================================================================
-- STEP 5: Rename Position columns
-- ============================================================================

ALTER TABLE "Position" RENAME COLUMN "amountOutcomeA" TO "amount0";
ALTER TABLE "Position" RENAME COLUMN "amountOutcomeB" TO "amount1";
ALTER TABLE "Position" RENAME COLUMN "weightedOutcomeA" TO "weighted0";
ALTER TABLE "Position" RENAME COLUMN "weightedOutcomeB" TO "weighted1";

-- ============================================================================
-- STEP 6: Migrate data - Create Events from Markets
-- ============================================================================

-- Create an Event for each existing Market
INSERT INTO "Event" ("id", "slug", "title", "description", "category", "bannerUrl", "logoUrl", "createdAt", "updatedAt")
SELECT 
    'evt_' || m."id",
    m."slug",
    m."title",
    NULL,
    m."category",
    m."bannerUrl",
    m."logoUrl",
    m."createdAt",
    m."updatedAt"
FROM "Market" m;

-- Update Market to reference its new Event
UPDATE "Market" m
SET "eventId" = 'evt_' || m."id";

-- Migrate question: use existing question if set, otherwise use title
UPDATE "Market"
SET "question" = COALESCE("question", "title")
WHERE "question" IS NULL OR "question" = '';

-- ============================================================================
-- STEP 7: Migrate Outcome data to Market JSON fields
-- ============================================================================

-- Build outcomes JSON array from Outcome records
-- We order by key to ensure A=index 0, B=index 1
UPDATE "Market" m
SET 
    "outcomes" = (
        SELECT '["' || STRING_AGG(o."label", '", "' ORDER BY o."key") || '"]'
        FROM "Outcome" o
        WHERE o."marketId" = m."id"
    ),
    "outcomeColors" = (
        SELECT 
            CASE 
                WHEN COUNT(o."color") > 0 THEN
                    '["' || STRING_AGG(COALESCE(o."color", '#888888'), '", "' ORDER BY o."key") || '"]'
                ELSE NULL
            END
        FROM "Outcome" o
        WHERE o."marketId" = m."id"
    )
WHERE EXISTS (SELECT 1 FROM "Outcome" o WHERE o."marketId" = m."id");

-- ============================================================================
-- STEP 8: Calculate pool totals from confirmed bets
-- ============================================================================

-- Calculate pool0 (sum of confirmed bets on outcome A/index 0)
UPDATE "Market" m
SET "pool0" = COALESCE((
    SELECT SUM(b."amount")
    FROM "Bet" b
    JOIN "Outcome" o ON b."outcomeId" = o."id"
    WHERE b."marketId" = m."id"
      AND b."status" = 'CONFIRMED'
      AND o."key" = 'A'
), 0);

-- Calculate pool1 (sum of confirmed bets on outcome B/index 1)
UPDATE "Market" m
SET "pool1" = COALESCE((
    SELECT SUM(b."amount")
    FROM "Bet" b
    JOIN "Outcome" o ON b."outcomeId" = o."id"
    WHERE b."marketId" = m."id"
      AND b."status" = 'CONFIRMED'
      AND o."key" = 'B'
), 0);

-- ============================================================================
-- STEP 9: Migrate Bet outcomeId to outcomeIndex
-- ============================================================================

-- Convert outcomeId to outcomeIndex (A=0, B=1)
UPDATE "Bet" b
SET "outcomeIndex" = CASE 
    WHEN o."key" = 'A' THEN 0
    WHEN o."key" = 'B' THEN 1
    ELSE 0
END
FROM "Outcome" o
WHERE b."outcomeId" = o."id";

-- Handle any orphaned bets (default to 0)
UPDATE "Bet" SET "outcomeIndex" = 0 WHERE "outcomeIndex" IS NULL;

-- ============================================================================
-- STEP 10: Migrate resolvedOutcomeId to resolvedOutcome index
-- ============================================================================

UPDATE "Market" m
SET "resolvedOutcome" = CASE 
    WHEN o."key" = 'A' THEN 0
    WHEN o."key" = 'B' THEN 1
    ELSE NULL
END
FROM "Outcome" o
WHERE m."resolvedOutcomeId" = o."id";

-- ============================================================================
-- STEP 11: Make columns NOT NULL and add constraints
-- ============================================================================

-- Make eventId required
ALTER TABLE "Market" ALTER COLUMN "eventId" SET NOT NULL;

-- Make outcomeIndex required
ALTER TABLE "Bet" ALTER COLUMN "outcomeIndex" SET NOT NULL;

-- Add foreign key for Market -> Event
ALTER TABLE "Market" ADD CONSTRAINT "Market_eventId_fkey" 
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add index on Market.eventId
CREATE INDEX "Market_eventId_idx" ON "Market"("eventId");

-- Add index on Bet.outcomeIndex
CREATE INDEX "Bet_outcomeIndex_idx" ON "Bet"("outcomeIndex");

-- ============================================================================
-- STEP 12: Drop old columns and tables
-- ============================================================================

-- Drop old Bet foreign key and column
ALTER TABLE "Bet" DROP CONSTRAINT IF EXISTS "Bet_outcomeId_fkey";
DROP INDEX IF EXISTS "Bet_outcomeId_idx";
ALTER TABLE "Bet" DROP COLUMN "outcomeId";

-- Drop old Market columns
DROP INDEX IF EXISTS "Market_category_idx";
ALTER TABLE "Market" DROP COLUMN "slug";
ALTER TABLE "Market" DROP COLUMN "title";
ALTER TABLE "Market" DROP COLUMN "category";
ALTER TABLE "Market" DROP COLUMN "bannerUrl";
ALTER TABLE "Market" DROP COLUMN "logoUrl";
ALTER TABLE "Market" DROP COLUMN "resolvedOutcomeId";

-- Drop Outcome table
DROP TABLE "Outcome";

-- Drop OutcomeKey enum
DROP TYPE "OutcomeKey";

-- ============================================================================
-- STEP 13: Update existing indexes on Market
-- Note: Some indexes were dropped with columns, need to recreate for new structure
-- ============================================================================

-- Market indexes are already in place from Step 11
