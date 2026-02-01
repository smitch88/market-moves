import { cookies, headers } from "next/headers";
import { prisma, UserRole } from "@vault/database";
import { verifyPrivyToken, privyClient } from "./privy";
import { provisionUser } from "./provision";
import { isAdmin as checkIsAdmin } from "./admin-allowlist";

export interface SessionUser {
  id: string;
  privyUserId: string;
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
 * Get the current session user from cookies/headers.
 * Returns null if not authenticated.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    // Try to get token from cookies first (Next.js sets this)
    const cookieStore = await cookies();
    let authToken = cookieStore.get("privy-token")?.value;

    // Fallback to Authorization header
    if (!authToken) {
      const headersList = await headers();
      const authHeader = headersList.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        authToken = authHeader.slice(7);
      }
    }

    if (!authToken) {
      return null;
    }

    // Verify the token
    const claims = await verifyPrivyToken(authToken);
    if (!claims) {
      return null;
    }

    // Look up user in database
    let user = await prisma.user.findUnique({
      where: { privyUserId: claims.userId },
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

    // If user exists, check if they should be admin but aren't yet
    if (user && user.role !== UserRole.ADMIN) {
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

    // If user doesn't exist, provision them
    if (!user) {
      // Get user details from Privy
      const privyUser = await privyClient.getUser(claims.userId);
      
      const twitterAccount = privyUser.linkedAccounts?.find(
        (account) => account.type === "twitter_oauth"
      );
      const emailAccount = privyUser.linkedAccounts?.find(
        (account) => account.type === "email"
      );

      try {
        const provisioned = await provisionUser({
          privyUserId: claims.userId,
          email: emailAccount && 'address' in emailAccount ? emailAccount.address : null,
          twitterSubject: twitterAccount && 'subject' in twitterAccount ? twitterAccount.subject : null,
          handle: twitterAccount && 'username' in twitterAccount ? twitterAccount.username : null,
          name: twitterAccount && 'name' in twitterAccount ? (twitterAccount.name as string) : null,
          profileImageUrl: twitterAccount && 'profilePictureUrl' in twitterAccount ? (twitterAccount.profilePictureUrl as string) : null,
          // Note: Privy doesn't provide Twitter banner URL directly, will be null
          bannerImageUrl: twitterAccount && 'profileBannerUrl' in twitterAccount ? (twitterAccount.profileBannerUrl as string) : null,
        });
        // Return directly since provisionUser already returns the correct type
        return provisioned as SessionUser;
      } catch (err) {
        // Handle race condition: if another request created the user, fetch them
        if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
          const dbUser = await prisma.user.findUnique({
            where: { privyUserId: claims.userId },
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
          if (!dbUser) {
            throw err; // Re-throw if still not found
          }
          return {
            ...dbUser,
            balance: Number(dbUser.balance),
          } as SessionUser;
        } else {
          throw err;
        }
      }
    }

    // Convert balance to number for SessionUser type
    if (user) {
      return {
        ...user,
        balance: typeof user.balance === 'number' ? user.balance : Number(user.balance),
      } as SessionUser;
    }
    return null;
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
