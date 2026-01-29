-- Add isPublished column to Event table with default false
ALTER TABLE "Event" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;

-- Add isPublished column to Market table with default false
ALTER TABLE "Market" ADD COLUMN "isPublished" BOOLEAN NOT NULL DEFAULT false;

-- Set all existing events to published (since they were already live)
UPDATE "Event" SET "isPublished" = true;

-- Set all existing markets to published (since they were already live)
UPDATE "Market" SET "isPublished" = true;

-- Create indexes for efficient filtering
CREATE INDEX "Event_isPublished_idx" ON "Event"("isPublished");
CREATE INDEX "Market_isPublished_idx" ON "Market"("isPublished");
