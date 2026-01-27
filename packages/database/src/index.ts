import { PrismaClient, Prisma } from "./generated/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export types from Prisma client
export type {
  User,
  Market,
  Outcome,
  Bet,
  Position,
  BalanceLedger,
  Referral,
  RaffleEntry,
  TweetProof,
  AdminActionLog,
} from "./generated/client";

export {
  UserRole,
  MarketStatus,
  MarketCategory,
  OutcomeKey,
  BetStatus,
  BalanceReason,
  RaffleReason,
  TweetProofMethod,
  AdminAction,
} from "./generated/client";

// Export Prisma namespace for advanced types
export { Prisma, PrismaClient };
