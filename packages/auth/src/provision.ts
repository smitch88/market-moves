import { prisma, BalanceReason, UserRole } from "@vault/database";
import { isAdmin as checkIsAdmin } from "./admin-allowlist";

const INITIAL_BALANCE = 10000;

export interface ProvisionUserInput {
  privyUserId: string;
  email?: string | null;
  walletAddress?: string | null;
  twitterSubject?: string | null;
  handle?: string | null;
  name?: string | null;
  profileImageUrl?: string | null;
  referralCode?: string | null; // Code of the referrer
}

export async function provisionUser(input: ProvisionUserInput) {
  const {
    privyUserId,
    email,
    walletAddress,
    twitterSubject,
    handle,
    name,
    profileImageUrl,
    referralCode,
  } = input;

  // Determine role based on admin allowlist (checks both Twitter ID and email)
  const isAdmin = checkIsAdmin(twitterSubject, email);

  // Create user with initial balance
  const user = await prisma.$transaction(async (tx) => {
    // Create the user
    const newUser = await tx.user.create({
      data: {
        privyUserId,
        email,
        walletAddress,
        twitterSubject,
        handle,
        name,
        profileImageUrl,
        role: isAdmin ? UserRole.ADMIN : UserRole.USER,
        balance: INITIAL_BALANCE,
      },
      select: {
        id: true,
        privyUserId: true,
        email: true,
        handle: true,
        name: true,
        profileImageUrl: true,
        role: true,
        balance: true,
        referralCode: true,
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

  return user;
}
