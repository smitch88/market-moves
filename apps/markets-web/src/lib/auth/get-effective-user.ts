import { cookies } from "next/headers";
import { getSessionUser } from "@vault/auth";
import { prisma } from "@vault/database";

const isDev = process.env.NODE_ENV === "development";
const IMPERSONATE_COOKIE = "dev-impersonate-twitter-id";

export interface EffectiveUser {
  id: string;
  privyUserId: string;
  email: string | null;
  walletAddress: string | null;
  twitterSubject: string | null;
  handle: string | null;
  name: string | null;
  profileImageUrl: string | null;
  role: string;
  balance: number;
  balanceLocked: boolean;
  referralCode: string;
  createdAt: Date;
  updatedAt: Date;
  _impersonated?: boolean;
  _count?: {
    referralsGiven: number;
  };
}

/**
 * Get the effective user for the current request.
 * In development mode, checks for impersonation first.
 * Falls back to normal Privy authentication.
 */
export async function getEffectiveUser(): Promise<EffectiveUser | null> {
  // Check for dev impersonation first
  if (isDev) {
    try {
      const cookieStore = await cookies();
      const impersonateTwitterId = cookieStore.get(IMPERSONATE_COOKIE)?.value;

      if (impersonateTwitterId) {
        const impersonatedUser = await prisma.user.findFirst({
          where: { twitterSubject: impersonateTwitterId },
          include: {
            _count: {
              select: { referralsGiven: true },
            },
          },
        });

        if (impersonatedUser) {
          return {
            ...impersonatedUser,
            _impersonated: true,
          } as EffectiveUser;
        }
      }
    } catch (error) {
      // Cookie access might fail in some contexts, continue to normal auth
      console.warn("Failed to check impersonation cookie:", error);
    }
  }

  // Normal auth flow
  const user = await getSessionUser();
  return user as EffectiveUser | null;
}

/**
 * Require an effective user or throw.
 * Useful for protected API routes.
 */
export async function requireEffectiveUser(): Promise<EffectiveUser> {
  const user = await getEffectiveUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

/**
 * Check if the current request is using impersonation.
 */
export async function isImpersonating(): Promise<boolean> {
  if (!isDev) return false;

  try {
    const cookieStore = await cookies();
    const impersonateTwitterId = cookieStore.get(IMPERSONATE_COOKIE)?.value;
    return !!impersonateTwitterId;
  } catch {
    return false;
  }
}
