-- CreateEnum
CREATE TYPE "MarketRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CREATED');

-- CreateTable
CREATE TABLE "MarketRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "status" "MarketRequestStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketRequest_userId_idx" ON "MarketRequest"("userId");

-- CreateIndex
CREATE INDEX "MarketRequest_status_idx" ON "MarketRequest"("status");

-- CreateIndex
CREATE INDEX "MarketRequest_createdAt_idx" ON "MarketRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "MarketRequest" ADD CONSTRAINT "MarketRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketRequest" ADD CONSTRAINT "MarketRequest_reviewedBy_fkey" FOREIGN KEY ("reviewedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
