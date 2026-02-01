-- Add KOL attribution fields to Event and Market tables
-- This allows attributing events and markets to specific KOL/captain creators

-- Add createdByKolId to Event table
ALTER TABLE "Event" ADD COLUMN "createdByKolId" TEXT;

-- Add createdByKolId to Market table  
ALTER TABLE "Market" ADD COLUMN "createdByKolId" TEXT;

-- Add foreign key constraints
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdByKolId_fkey" FOREIGN KEY ("createdByKolId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Market" ADD CONSTRAINT "Market_createdByKolId_fkey" FOREIGN KEY ("createdByKolId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes for efficient querying
CREATE INDEX "Event_createdByKolId_idx" ON "Event"("createdByKolId");
CREATE INDEX "Market_createdByKolId_idx" ON "Market"("createdByKolId");
