-- CreateTable
CREATE TABLE "LeaderboardPnLSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "realizedPnL" DECIMAL(19,4) NOT NULL,
    "unrealizedPnL" DECIMAL(19,4) NOT NULL,
    "totalPnL" DECIMAL(19,4) NOT NULL,
    "totalVolume" DECIMAL(19,2) NOT NULL,
    "refreshedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardPnLSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshotMeta" (
    "id" TEXT NOT NULL DEFAULT 'pnl_snapshot',
    "lastRefresh" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "error" TEXT,

    CONSTRAINT "LeaderboardSnapshotMeta_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardPnLSnapshot_userId_key" ON "LeaderboardPnLSnapshot"("userId");

-- CreateIndex
CREATE INDEX "LeaderboardPnLSnapshot_totalPnL_idx" ON "LeaderboardPnLSnapshot"("totalPnL" DESC);

-- CreateIndex
CREATE INDEX "LeaderboardPnLSnapshot_refreshedAt_idx" ON "LeaderboardPnLSnapshot"("refreshedAt");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshotMeta_lastRefresh_idx" ON "LeaderboardSnapshotMeta"("lastRefresh");
