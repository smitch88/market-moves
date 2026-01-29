-- Add XP system tables and fields

-- Add xp field to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0;

-- Create XPLedger table for XP history/audit
CREATE TABLE IF NOT EXISTS "XPLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "xpBefore" INTEGER NOT NULL,
    "xpAfter" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "correlationId" TEXT,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "XPLedger_pkey" PRIMARY KEY ("id")
);

-- Create XPConfig table for configurable settings
CREATE TABLE IF NOT EXISTS "XPConfig" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "XPConfig_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "XPLedger_userId_idx" ON "XPLedger"("userId");
CREATE INDEX IF NOT EXISTS "XPLedger_createdAt_idx" ON "XPLedger"("createdAt");
CREATE INDEX IF NOT EXISTS "XPLedger_reason_idx" ON "XPLedger"("reason");
CREATE UNIQUE INDEX IF NOT EXISTS "XPConfig_key_key" ON "XPConfig"("key");

-- Add foreign keys
ALTER TABLE "XPLedger" ADD CONSTRAINT "XPLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "XPLedger" ADD CONSTRAINT "XPLedger_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert default XP configuration
INSERT INTO "XPConfig" ("id", "key", "value", "description", "updatedAt")
VALUES 
    (gen_random_uuid()::text, 'xp_per_dollar_volume', '10', 'XP awarded per $1 of trading volume', NOW())
ON CONFLICT ("key") DO NOTHING;
