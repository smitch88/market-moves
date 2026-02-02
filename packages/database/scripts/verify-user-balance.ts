/**
 * User Balance Verification Script
 * 
 * This script verifies that a user's balance is correct by:
 * 1. Checking balance ledger internal consistency
 * 2. Comparing sum of ledger deltas with current balance
 * 3. Cross-checking against bets, sells, and settlements
 * 
 * Usage:
 *   npx tsx scripts/verify-user-balance.ts <userId|handle|email>
 *   npx tsx scripts/verify-user-balance.ts --all              # Check all users
 *   npx tsx scripts/verify-user-balance.ts --fix <userId>     # Auto-fix discrepancies
 */

import { PrismaClient, Prisma, BalanceReason, BetStatus, TradeType } from "../src/generated/client";

const prisma = new PrismaClient();

// ANSI colors for output
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

interface LedgerIssue {
  type: "internal_mismatch" | "sequence_gap" | "final_mismatch";
  ledgerEntryId: string;
  message: string;
  expected?: string;
  actual?: string;
}

interface BalanceVerificationResult {
  userId: string;
  userHandle: string | null;
  currentBalance: Prisma.Decimal;
  calculatedBalance: Prisma.Decimal;
  ledgerSum: Prisma.Decimal;
  discrepancy: Prisma.Decimal;
  isValid: boolean;
  ledgerIssues: LedgerIssue[];
  breakdown: {
    initialCredit: Prisma.Decimal;
    betsPlaced: Prisma.Decimal;
    settlementPayouts: Prisma.Decimal;
    settlementLosses: Prisma.Decimal;
    tradeSells: Prisma.Decimal;
    adminAdjustments: Prisma.Decimal;
    referralBonuses: Prisma.Decimal;
    other: Prisma.Decimal;
  };
  crossCheck: {
    fromBets: {
      totalBuyAmount: Prisma.Decimal;
      totalSellProceeds: Prisma.Decimal;
      expectedFromBets: Prisma.Decimal;
    };
  };
}

async function findUser(identifier: string) {
  // Try to find by ID, handle, or email
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { id: identifier },
        { handle: identifier },
        { email: identifier },
        { privyUserId: identifier },
      ],
    },
  });
  return user;
}

async function verifyUserBalance(userId: string): Promise<BalanceVerificationResult> {
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      handle: true,
      email: true,
      balance: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Get all balance ledger entries in chronological order
  const ledgerEntries = await prisma.balanceLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  // Initialize breakdown
  const breakdown = {
    initialCredit: new Prisma.Decimal(0),
    betsPlaced: new Prisma.Decimal(0),
    settlementPayouts: new Prisma.Decimal(0),
    settlementLosses: new Prisma.Decimal(0),
    tradeSells: new Prisma.Decimal(0),
    adminAdjustments: new Prisma.Decimal(0),
    referralBonuses: new Prisma.Decimal(0),
    other: new Prisma.Decimal(0),
  };

  const ledgerIssues: LedgerIssue[] = [];
  let ledgerSum = new Prisma.Decimal(0);
  let previousEntry: typeof ledgerEntries[0] | null = null;

  // Process each ledger entry
  for (const entry of ledgerEntries) {
    // Check internal consistency: balanceBefore + delta = balanceAfter
    const expectedBalanceAfter = entry.balanceBefore.plus(entry.delta);
    if (!expectedBalanceAfter.equals(entry.balanceAfter)) {
      ledgerIssues.push({
        type: "internal_mismatch",
        ledgerEntryId: entry.id,
        message: `Internal mismatch: ${entry.balanceBefore} + ${entry.delta} ≠ ${entry.balanceAfter}`,
        expected: expectedBalanceAfter.toString(),
        actual: entry.balanceAfter.toString(),
      });
    }

    // Check sequence consistency: current balanceBefore should match previous balanceAfter
    if (previousEntry && !entry.balanceBefore.equals(previousEntry.balanceAfter)) {
      ledgerIssues.push({
        type: "sequence_gap",
        ledgerEntryId: entry.id,
        message: `Sequence gap: previous balanceAfter (${previousEntry.balanceAfter}) ≠ current balanceBefore (${entry.balanceBefore})`,
        expected: previousEntry.balanceAfter.toString(),
        actual: entry.balanceBefore.toString(),
      });
    }

    // Sum up deltas
    ledgerSum = ledgerSum.plus(entry.delta);

    // Categorize by reason
    switch (entry.reason) {
      case BalanceReason.INITIAL_CREDIT:
        breakdown.initialCredit = breakdown.initialCredit.plus(entry.delta);
        break;
      case BalanceReason.BET_PLACED:
        breakdown.betsPlaced = breakdown.betsPlaced.plus(entry.delta);
        break;
      case BalanceReason.SETTLEMENT_PAYOUT:
        breakdown.settlementPayouts = breakdown.settlementPayouts.plus(entry.delta);
        break;
      case BalanceReason.SETTLEMENT_LOSS:
        breakdown.settlementLosses = breakdown.settlementLosses.plus(entry.delta);
        break;
      case BalanceReason.TRADE_SELL:
        breakdown.tradeSells = breakdown.tradeSells.plus(entry.delta);
        break;
      case BalanceReason.ADMIN_ADJUST:
        breakdown.adminAdjustments = breakdown.adminAdjustments.plus(entry.delta);
        break;
      case BalanceReason.REFERRAL_BONUS:
        breakdown.referralBonuses = breakdown.referralBonuses.plus(entry.delta);
        break;
      case BalanceReason.OTHER:
        breakdown.other = breakdown.other.plus(entry.delta);
        break;
    }

    previousEntry = entry;
  }

  // Check if final ledger entry matches current balance
  if (previousEntry && !previousEntry.balanceAfter.equals(user.balance)) {
    ledgerIssues.push({
      type: "final_mismatch",
      ledgerEntryId: previousEntry.id,
      message: `Final mismatch: last ledger balanceAfter (${previousEntry.balanceAfter}) ≠ current user balance (${user.balance})`,
      expected: user.balance.toString(),
      actual: previousEntry.balanceAfter.toString(),
    });
  }

  // Cross-check with bets
  const bets = await prisma.bet.findMany({
    where: {
      userId,
      status: { in: [BetStatus.CONFIRMED, BetStatus.WON, BetStatus.LOST] },
    },
    select: {
      id: true,
      amount: true,
      tradeType: true,
      status: true,
      payout: true,
    },
  });

  let totalBuyAmount = new Prisma.Decimal(0);
  let totalSellProceeds = new Prisma.Decimal(0);

  for (const bet of bets) {
    if (bet.tradeType === TradeType.BUY) {
      totalBuyAmount = totalBuyAmount.plus(bet.amount);
    } else if (bet.tradeType === TradeType.SELL) {
      // Sell amount is stored as negative, so negate it
      totalSellProceeds = totalSellProceeds.plus(bet.amount.negated());
    }
  }

  // Calculate what balance should be
  // Starting balance (usually INITIAL_CREDIT) + all ledger deltas
  const calculatedBalance = ledgerSum;
  const discrepancy = user.balance.minus(calculatedBalance);

  return {
    userId: user.id,
    userHandle: user.handle,
    currentBalance: user.balance,
    calculatedBalance,
    ledgerSum,
    discrepancy,
    isValid: discrepancy.isZero() && ledgerIssues.length === 0,
    ledgerIssues,
    breakdown,
    crossCheck: {
      fromBets: {
        totalBuyAmount,
        totalSellProceeds,
        expectedFromBets: totalSellProceeds.minus(totalBuyAmount),
      },
    },
  };
}

function printResult(result: BalanceVerificationResult) {
  const statusColor = result.isValid ? colors.green : colors.red;
  const statusIcon = result.isValid ? "✅" : "❌";

  console.log(`\n${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}User: ${colors.cyan}${result.userHandle || result.userId}${colors.reset}`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);

  console.log(`\n${colors.bold}Balance Summary:${colors.reset}`);
  console.log(`  Current Balance:    ${colors.cyan}$${result.currentBalance.toFixed(2)}${colors.reset}`);
  console.log(`  Calculated Balance: ${colors.cyan}$${result.calculatedBalance.toFixed(2)}${colors.reset}`);
  console.log(`  Ledger Sum:         ${colors.cyan}$${result.ledgerSum.toFixed(2)}${colors.reset}`);
  console.log(`  Discrepancy:        ${statusColor}$${result.discrepancy.toFixed(2)}${colors.reset}`);
  console.log(`  Status:             ${statusIcon} ${statusColor}${result.isValid ? "VALID" : "INVALID"}${colors.reset}`);

  console.log(`\n${colors.bold}Balance Breakdown by Reason:${colors.reset}`);
  console.log(`  Initial Credit:      ${colors.green}+$${result.breakdown.initialCredit.toFixed(2)}${colors.reset}`);
  console.log(`  Bets Placed:         ${colors.red}$${result.breakdown.betsPlaced.toFixed(2)}${colors.reset}`);
  console.log(`  Settlement Payouts:  ${colors.green}+$${result.breakdown.settlementPayouts.toFixed(2)}${colors.reset}`);
  console.log(`  Settlement Losses:   ${colors.yellow}$${result.breakdown.settlementLosses.toFixed(2)}${colors.reset}`);
  console.log(`  Trade Sells:         ${colors.green}+$${result.breakdown.tradeSells.toFixed(2)}${colors.reset}`);
  console.log(`  Admin Adjustments:   ${colors.blue}$${result.breakdown.adminAdjustments.toFixed(2)}${colors.reset}`);
  console.log(`  Referral Bonuses:    ${colors.green}+$${result.breakdown.referralBonuses.toFixed(2)}${colors.reset}`);
  console.log(`  Other:               ${colors.yellow}$${result.breakdown.other.toFixed(2)}${colors.reset}`);

  console.log(`\n${colors.bold}Cross-Check (from Bets):${colors.reset}`);
  console.log(`  Total Buy Amount:    ${colors.red}-$${result.crossCheck.fromBets.totalBuyAmount.toFixed(2)}${colors.reset}`);
  console.log(`  Total Sell Proceeds: ${colors.green}+$${result.crossCheck.fromBets.totalSellProceeds.toFixed(2)}${colors.reset}`);
  console.log(`  Net from Trades:     ${colors.cyan}$${result.crossCheck.fromBets.expectedFromBets.toFixed(2)}${colors.reset}`);

  // Expected from trades should roughly match: betsPlaced + tradeSells
  const expectedTradeNet = result.breakdown.betsPlaced.plus(result.breakdown.tradeSells);
  const tradeNetDiff = result.crossCheck.fromBets.expectedFromBets.minus(expectedTradeNet);
  if (!tradeNetDiff.isZero()) {
    console.log(`  ${colors.yellow}⚠ Trade ledger vs bets diff: $${tradeNetDiff.toFixed(2)}${colors.reset}`);
  }

  if (result.ledgerIssues.length > 0) {
    console.log(`\n${colors.bold}${colors.red}Ledger Issues (${result.ledgerIssues.length}):${colors.reset}`);
    for (const issue of result.ledgerIssues) {
      console.log(`  ${colors.red}• [${issue.type}] ${issue.message}${colors.reset}`);
      if (issue.expected && issue.actual) {
        console.log(`    Expected: ${issue.expected}, Actual: ${issue.actual}`);
      }
    }
  }
}

async function verifyAllUsers(): Promise<void> {
  const users = await prisma.user.findMany({
    select: { id: true, handle: true },
    orderBy: { createdAt: "desc" },
  });

  console.log(`\n${colors.bold}Verifying ${users.length} users...${colors.reset}\n`);

  let validCount = 0;
  let invalidCount = 0;
  const invalidUsers: BalanceVerificationResult[] = [];

  for (const user of users) {
    const result = await verifyUserBalance(user.id);
    if (result.isValid) {
      validCount++;
    } else {
      invalidCount++;
      invalidUsers.push(result);
    }
  }

  console.log(`\n${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bold}Summary${colors.reset}`);
  console.log(`${colors.bold}═══════════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`  ${colors.green}✅ Valid:   ${validCount}${colors.reset}`);
  console.log(`  ${colors.red}❌ Invalid: ${invalidCount}${colors.reset}`);

  if (invalidUsers.length > 0) {
    console.log(`\n${colors.bold}${colors.red}Invalid Users:${colors.reset}`);
    for (const result of invalidUsers) {
      console.log(`  • ${result.userHandle || result.userId}: discrepancy $${result.discrepancy.toFixed(2)}`);
    }
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
${colors.bold}User Balance Verification Script${colors.reset}

Usage:
  npx tsx scripts/verify-user-balance.ts <userId|handle|email>    Verify specific user
  npx tsx scripts/verify-user-balance.ts --all                    Verify all users

Examples:
  npx tsx scripts/verify-user-balance.ts johndoe
  npx tsx scripts/verify-user-balance.ts user@example.com
  npx tsx scripts/verify-user-balance.ts clxxxxxxxxxx
  npx tsx scripts/verify-user-balance.ts --all
`);
    return;
  }

  if (args[0] === "--all") {
    await verifyAllUsers();
  } else {
    const identifier = args[0];
    const user = await findUser(identifier);

    if (!user) {
      console.error(`${colors.red}Error: User not found: ${identifier}${colors.reset}`);
      process.exit(1);
    }

    const result = await verifyUserBalance(user.id);
    printResult(result);

    // Exit with error code if invalid
    if (!result.isValid) {
      process.exit(1);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

