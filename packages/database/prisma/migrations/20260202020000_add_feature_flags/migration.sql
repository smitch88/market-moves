-- CreateEnum
CREATE TYPE "FeatureFlagStatus" AS ENUM ('OFF', 'ON', 'ADMIN_ONLY');

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "FeatureFlagStatus" NOT NULL DEFAULT 'OFF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_key_idx" ON "FeatureFlag"("key");

-- CreateIndex
CREATE INDEX "FeatureFlag_status_idx" ON "FeatureFlag"("status");

-- Insert initial feature flag for daily spin
INSERT INTO "FeatureFlag" ("id", "key", "name", "description", "status", "createdAt", "updatedAt")
VALUES (
    'ff_daily_spin',
    'daily_spin',
    'Daily Spin',
    'Daily spin wheel for bonus balance rewards',
    'ON',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

