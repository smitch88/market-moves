-- AlterTable
ALTER TABLE "User" ADD COLUMN     "realizedPnL" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalVolume" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "UserPnLSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realizedPnL" INTEGER NOT NULL,
    "unrealizedPnL" INTEGER NOT NULL,
    "totalVolume" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPnLSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPnLSnapshot_userId_createdAt_idx" ON "UserPnLSnapshot"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserPnLSnapshot" ADD CONSTRAINT "UserPnLSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
