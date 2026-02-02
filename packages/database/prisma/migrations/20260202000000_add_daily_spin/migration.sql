-- Add DAILY_SPIN to BalanceReason enum
ALTER TYPE "BalanceReason" ADD VALUE 'DAILY_SPIN';

-- Create DailySpin table
CREATE TABLE "DailySpin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "spinDate" DATE NOT NULL,
    "reward" DECIMAL(19,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailySpin_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "DailySpin_userId_idx" ON "DailySpin"("userId");
CREATE INDEX "DailySpin_spinDate_idx" ON "DailySpin"("spinDate");
CREATE UNIQUE INDEX "DailySpin_userId_spinDate_key" ON "DailySpin"("userId", "spinDate");

-- Add foreign key constraint
ALTER TABLE "DailySpin" ADD CONSTRAINT "DailySpin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


