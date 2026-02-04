import { prisma, BalanceReason, UserRole } from "@vault/database";
import { isAdmin as checkIsAdmin } from "./admin-allowlist";

const INITIAL_BALANCE = 10000;

export interface ProvisionUserInput {
  twitterSubject: string;
  email?: string | null;
  walletAddress?: string | null;
  handle?: string | null;
  name?: string | null;
  profileImageUrl?: string | null;
  bannerImageUrl?: string | null;
  referralCode?: string | null; // Code of the referrer
}

export type ProvisionedUser = {
  id: string;
  privyUserId: string;
  email: string | null;
  twitterSubject: string | null;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  role: "USER" | "ADMIN";
  balance: number;
  referralCode: string;
  hasSeenWelcomeModal: boolean;
  isKOL: boolean;
  createdAt: Date;
  _count: { referralsGiven: number };
};

export async function provisionUser(input: ProvisionUserInput): Promise<ProvisionedUser> {
  const {
    twitterSubject,
    email,
    walletAddress,
    handle,
    name,
    profileImageUrl,
    bannerImageUrl,
    referralCode,
  } = input;

  // Check if user already exists by twitterSubject
  const existingUser = await prisma.user.findFirst({
    where: { twitterSubject },
    select: {
      id: true,
      privyUserId: true,
      email: true,
      twitterSubject: true,
      handle: true,
      name: true,
      profileImageUrl: true,
      bannerImageUrl: true,
      role: true,
      balance: true,
      referralCode: true,
      hasSeenWelcomeModal: true,
      isKOL: true,
      createdAt: true,
      _count: {
        select: { referralsGiven: true },
      },
    },
  });

  if (existingUser) {
    // Return existing user
    return {
      ...existingUser,
      balance: Number(existingUser.balance),
    };
  }

  // Determine role based on admin allowlist (checks both Twitter ID and email)
  const isAdmin = checkIsAdmin(twitterSubject, email);

  // Create user with initial balance
  const user = await prisma.$transaction(async (tx) => {
    // Create the user - privyUserId is set to twitterSubject for backwards compatibility
    const newUser = await tx.user.create({
      data: {
        privyUserId: `twitter:${twitterSubject}`, // Legacy field, prefixed to differentiate
        email,
        walletAddress,
        twitterSubject,
        handle,
        name,
        profileImageUrl,
        bannerImageUrl,
        role: isAdmin ? UserRole.ADMIN : UserRole.USER,
        balance: INITIAL_BALANCE,
      },
      select: {
        id: true,
        privyUserId: true,
        email: true,
        twitterSubject: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        bannerImageUrl: true,
        role: true,
        balance: true,
        referralCode: true,
        hasSeenWelcomeModal: true,
        isKOL: true,
        createdAt: true,
        _count: {
          select: { referralsGiven: true },
        },
      },
    });

    // Create initial balance ledger entry
    await tx.balanceLedger.create({
      data: {
        userId: newUser.id,
        delta: INITIAL_BALANCE,
        balanceBefore: 0,
        balanceAfter: INITIAL_BALANCE,
        reason: BalanceReason.INITIAL_CREDIT,
        correlationId: `initial_${newUser.id}`,
      },
    });

    // Handle referral attribution if referral code provided
    if (referralCode) {
      const referrer = await tx.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });

      if (referrer && referrer.id !== newUser.id) {
        await tx.referral.create({
          data: {
            referrerUserId: referrer.id,
            referredUserId: newUser.id,
          },
        });
      }
    }

    return newUser;
  });

  return {
    ...user,
    balance: Number(user.balance),
  };
}
