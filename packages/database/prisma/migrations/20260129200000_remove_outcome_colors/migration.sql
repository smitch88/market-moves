-- Drop the outcomeColors column from Market table
-- Colors are now centralized in the frontend application code
ALTER TABLE "Market" DROP COLUMN IF EXISTS "outcomeColors";
