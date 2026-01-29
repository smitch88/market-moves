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
  Event,
  Tag,
  Market,
  Bet,
  Position,
  BalanceLedger,
  UserPnLSnapshot,
  Referral,
  RaffleEntry,
  TweetProof,
  AdminActionLog,
  PriceSnapshot,
  XPLedger,
  XPConfig,
  PnLLedger,
} from "./generated/client";

export {
  UserRole,
  MarketStatus,
  MarketCategory,
  EventType,
  BetStatus,
  BalanceReason,
  RaffleReason,
  TweetProofMethod,
  AdminAction,
  TradeType,
  PricingModel,
  XPReason,
  PnLReason,
} from "./generated/client";

// Export Prisma namespace for advanced types
export { Prisma, PrismaClient };
