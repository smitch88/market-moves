-- Add pinned field to Event table
-- Pinned events appear at the top of the event grid regardless of sort order

ALTER TABLE "Event" ADD COLUMN "pinned" BOOLEAN NOT NULL DEFAULT false;

-- Add index for efficient querying
CREATE INDEX "Event_pinned_idx" ON "Event"("pinned");

