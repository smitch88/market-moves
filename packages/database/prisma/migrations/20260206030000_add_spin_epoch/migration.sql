-- Add spinEpoch column to DailySpin for 6-hour spin windows (0-3 per day)
ALTER TABLE "DailySpin" ADD COLUMN "spinEpoch" INTEGER NOT NULL DEFAULT 0;

-- Drop the old unique constraint (userId, spinDate)
ALTER TABLE "DailySpin" DROP CONSTRAINT IF EXISTS "DailySpin_userId_spinDate_key";

-- Create the new unique constraint (userId, spinDate, spinEpoch)
ALTER TABLE "DailySpin" ADD CONSTRAINT "DailySpin_userId_spinDate_spinEpoch_key" UNIQUE ("userId", "spinDate", "spinEpoch");
