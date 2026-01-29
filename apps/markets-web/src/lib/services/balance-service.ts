import { prisma, BalanceReason, type Prisma } from "@vault/database";

/**
 * Balance Service
 * 
 * Handles all balance-related operations with proper ledger tracking.
 * All balance changes should go through this service to ensure audit trail.
 */

export interface BalanceAdjustment {
  userId: string;
  delta: number;
  reason: BalanceReason;
  correlationId?: string;
  actorAdminUserId?: string;
}

export interface BalanceAdjustmentResult {
  userId: string;
  delta: number;
  balanceBefore: number;
  balanceAfter: number;
  ledgerEntryId: string;
}

/**
 * Adjust a user's balance with proper ledger tracking
 * This should be called within a Prisma transaction
 */
export async function adjustBalance(
  tx: Prisma.TransactionClient,
  adjustment: BalanceAdjustment
): Promise<BalanceAdjustmentResult> {
  const { userId, delta, reason, correlationId, actorAdminUserId } = adjustment;

  // Fetch current balance
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const balanceBefore = Number(user.balance);
  const balanceAfter = balanceBefore + delta;

  if (balanceAfter < 0) {
    throw new Error(`Insufficient balance: would result in ${balanceAfter}`);
  }

  // Update balance
  await tx.user.update({
    where: { id: userId },
    data: { balance: balanceAfter },
  });

  // Create ledger entry
  const ledgerEntry = await tx.balanceLedger.create({
    data: {
      userId,
      delta,
      balanceBefore,
      balanceAfter,
      reason,
      correlationId,
      actorAdminUserId,
    },
  });

  return {
    userId,
    delta,
    balanceBefore,
    balanceAfter,
    ledgerEntryId: ledgerEntry.id,
  };
}

/**
 * Debit a user's balance (for bet placement)
 */
export async function debitBalance(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  correlationId?: string
): Promise<BalanceAdjustmentResult> {
  return adjustBalance(tx, {
    userId,
    delta: -amount,
    reason: BalanceReason.BET_PLACED,
    correlationId,
  });
}

/**
 * Credit a user's balance (for settlement payout)
 */
export async function creditPayout(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  correlationId?: string
): Promise<BalanceAdjustmentResult> {
  return adjustBalance(tx, {
    userId,
    delta: amount,
    reason: BalanceReason.SETTLEMENT_PAYOUT,
    correlationId,
  });
}

/**
 * Refund a user's balance (for bet cancellation)
 */
export async function refundBet(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
  correlationId?: string,
  actorAdminUserId?: string
): Promise<BalanceAdjustmentResult> {
  return adjustBalance(tx, {
    userId,
    delta: amount,
    reason: BalanceReason.OTHER, // Could add BET_REFUND reason
    correlationId,
    actorAdminUserId,
  });
}

/**
 * Record a settlement loss (for tracking purposes, delta is 0)
 */
export async function recordLoss(
  tx: Prisma.TransactionClient,
  userId: string,
  correlationId?: string
): Promise<BalanceAdjustmentResult> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  const ledgerEntry = await tx.balanceLedger.create({
    data: {
      userId,
      delta: 0,
      balanceBefore: Number(user.balance),
      balanceAfter: Number(user.balance),
      reason: BalanceReason.SETTLEMENT_LOSS,
      correlationId,
    },
  });

  return {
    userId,
    delta: 0,
    balanceBefore: Number(user.balance),
    balanceAfter: Number(user.balance),
    ledgerEntryId: ledgerEntry.id,
  };
}

/**
 * Get user's current balance
 */
export async function getBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  return Number(user.balance);
}

/**
 * Check if user has sufficient balance
 */
export async function hasSufficientBalance(
  userId: string,
  amount: number
): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance >= amount;
}
