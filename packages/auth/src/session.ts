import { getServerSession } from "next-auth";
import { prisma, UserRole } from "@vault/database";
import { authOptions } from "./auth";
import { isAdmin as checkIsAdmin } from "./admin-allowlist";

export interface SessionUser {
  id: string;
  privyUserId: string; // Keep for backwards compatibility, will be empty for new users
  email: string | null;
  twitterSubject: string | null;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  bannerImageUrl: string | null;
  role: UserRole;
  balance: number;
  referralCode: string;
  hasSeenWelcomeModal: boolean;
  isKOL: boolean;
  createdAt: Date;
  _count?: {
    referralsGiven: number;
  };
}

/**
 * Get the current session user from NextAuth session.
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    // Get NextAuth session
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.twitterSubject) {
      return null;
    }

    const twitterSubject = session.user.twitterSubject;

    // Look up user in database by Twitter subject
    let user = await prisma.user.findFirst({
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

    if (!user) {
      return null;
    }

    // If user exists, check if they should be admin but aren't yet
    if (user.role !== UserRole.ADMIN) {
      const shouldBeAdmin = checkIsAdmin(user.twitterSubject, user.email);
      if (shouldBeAdmin) {
        // Update user to admin
        user = await prisma.user.update({
          where: { id: user.id },
          data: { role: UserRole.ADMIN },
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
        console.log(`User ${user.id} promoted to ADMIN based on allowlist`);
      }
    }

    // Convert balance to number for SessionUser type
    return {
      ...user,
      balance: typeof user.balance === 'number' ? user.balance : Number(user.balance),
    } as SessionUser;
  } catch (error) {
    console.error("Error getting session user:", error);
    return null;
  }
}

/**
 * Require an authenticated user. Throws if not authenticated.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Require an admin user. Throws if not authenticated or not admin.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}
