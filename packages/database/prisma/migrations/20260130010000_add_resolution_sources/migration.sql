-- CreateEnum
CREATE TYPE "ResolutionSourceType" AS ENUM ('INTERNAL', 'EXTERNAL', 'HYBRID');

-- CreateTable
CREATE TABLE "ResolutionSource" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "ResolutionSourceType" NOT NULL DEFAULT 'INTERNAL',
    "externalApiUrl" TEXT,
    "externalApiHeaders" JSONB,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolutionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionDataPoint" (
    "id" TEXT NOT NULL,
    "resolutionSourceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL DEFAULT 'string',
    "marketId" TEXT,
    "externalValue" TEXT,
    "externalFetchedAt" TIMESTAMP(3),
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "metadata" JSONB,
    "notes" TEXT,
    "effectiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResolutionDataPoint_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Market" ADD COLUMN "resolutionSourceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionSource_slug_key" ON "ResolutionSource"("slug");

-- CreateIndex
CREATE INDEX "ResolutionSource_slug_idx" ON "ResolutionSource"("slug");

-- CreateIndex
CREATE INDEX "ResolutionSource_type_idx" ON "ResolutionSource"("type");

-- CreateIndex
CREATE INDEX "ResolutionSource_isActive_idx" ON "ResolutionSource"("isActive");

-- CreateIndex
CREATE INDEX "ResolutionSource_isPublic_idx" ON "ResolutionSource"("isPublic");

-- CreateIndex
CREATE INDEX "ResolutionDataPoint_resolutionSourceId_idx" ON "ResolutionDataPoint"("resolutionSourceId");

-- CreateIndex
CREATE INDEX "ResolutionDataPoint_marketId_idx" ON "ResolutionDataPoint"("marketId");

-- CreateIndex
CREATE INDEX "ResolutionDataPoint_key_idx" ON "ResolutionDataPoint"("key");

-- CreateIndex
CREATE INDEX "ResolutionDataPoint_effectiveAt_idx" ON "ResolutionDataPoint"("effectiveAt");

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionDataPoint_resolutionSourceId_key_key" ON "ResolutionDataPoint"("resolutionSourceId", "key");

-- CreateIndex
CREATE INDEX "Market_resolutionSourceId_idx" ON "Market"("resolutionSourceId");

-- AddForeignKey
ALTER TABLE "Market" ADD CONSTRAINT "Market_resolutionSourceId_fkey" FOREIGN KEY ("resolutionSourceId") REFERENCES "ResolutionSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionDataPoint" ADD CONSTRAINT "ResolutionDataPoint_resolutionSourceId_fkey" FOREIGN KEY ("resolutionSourceId") REFERENCES "ResolutionSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionDataPoint" ADD CONSTRAINT "ResolutionDataPoint_marketId_fkey" FOREIGN KEY ("marketId") REFERENCES "Market"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Insert default Vault Markets resolution source
INSERT INTO "ResolutionSource" ("id", "slug", "name", "description", "type", "isActive", "isPublic", "createdAt", "updatedAt")
VALUES (
    'vault-markets-official',
    'vault-markets',
    'Vault Markets Official',
    'Official resolution source for Vault Markets predictions. Data is curated and verified by the Vault Markets team.',
    'INTERNAL',
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
