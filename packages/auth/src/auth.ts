import type { NextAuthOptions } from "next-auth";
import TwitterProvider from "next-auth/providers/twitter";
import { prisma, UserRole } from "@vault/database";
import { provisionUser } from "./provision";
import { isAdmin as checkIsAdmin } from "./admin-allowlist";

export const authOptions: NextAuthOptions = {
  providers: [
    TwitterProvider({
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
      version: "2.0",
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ account, profile }) {
      // Only allow Twitter sign-ins
      if (account?.provider !== "twitter") {
        return false;
      }

      // Get Twitter user ID from account
      const twitterSubject = account.providerAccountId;
      if (!twitterSubject) {
        console.error("No Twitter subject found in account");
        return false;
      }

      try {
        // Check if user exists
        let user = await prisma.user.findFirst({
          where: { twitterSubject },
        });

        if (!user) {
          // Provision new user
          const twitterProfile = profile as {
            data?: {
              id?: string;
              username?: string;
              name?: string;
              profile_image_url?: string;
            };
          };

          await provisionUser({
            twitterSubject,
            handle: twitterProfile?.data?.username || null,
            name: twitterProfile?.data?.name || null,
            profileImageUrl: twitterProfile?.data?.profile_image_url?.replace("_normal", "") || null,
          });
        } else {
          // Update user's Twitter profile info if changed
          const twitterProfile = profile as {
            data?: {
              username?: string;
              name?: string;
              profile_image_url?: string;
            };
          };

          const updates: Record<string, string | null> = {};
          
          if (twitterProfile?.data?.username && twitterProfile.data.username !== user.handle) {
            // Only update handle if user hasn't customized it
            if (!user.handle || user.handle === user.twitterSubject) {
              updates.handle = twitterProfile.data.username;
            }
          }
          if (twitterProfile?.data?.name && twitterProfile.data.name !== user.name) {
            updates.name = twitterProfile.data.name;
          }
          if (twitterProfile?.data?.profile_image_url) {
            const newImageUrl = twitterProfile.data.profile_image_url.replace("_normal", "");
            if (newImageUrl !== user.profileImageUrl) {
              updates.profileImageUrl = newImageUrl;
            }
          }

          if (Object.keys(updates).length > 0) {
            await prisma.user.update({
              where: { id: user.id },
              data: updates,
            });
          }
        }

        return true;
      } catch (error) {
        console.error("Error in signIn callback:", error);
        return false;
      }
    },

    async jwt({ token, account }) {
      // On initial sign in, add Twitter subject to token
      if (account?.provider === "twitter") {
        token.twitterSubject = account.providerAccountId;
        
        // Get user from database to include role and ID
        const user = await prisma.user.findFirst({
          where: { twitterSubject: account.providerAccountId },
          select: {
            id: true,
            role: true,
            twitterSubject: true,
            email: true,
          },
        });

        if (user) {
          token.userId = user.id;
          token.role = user.role;
          
          // Check if user should be promoted to admin
          if (user.role !== UserRole.ADMIN) {
            const shouldBeAdmin = checkIsAdmin(user.twitterSubject, user.email);
            if (shouldBeAdmin) {
              await prisma.user.update({
                where: { id: user.id },
                data: { role: UserRole.ADMIN },
              });
              token.role = UserRole.ADMIN;
              console.log(`User ${user.id} promoted to ADMIN based on allowlist`);
            }
          }
        }
      }

      return token;
    },

    async session({ session, token }) {
      // Expose custom fields to client session
      if (token.userId) {
        session.user.id = token.userId as string;
      }
      if (token.role) {
        session.user.role = token.role as string;
      }
      if (token.twitterSubject) {
        session.user.twitterSubject = token.twitterSubject as string;
      }

      return session;
    },
  },
  pages: {
    signIn: "/", // Redirect to home page for sign in
    error: "/", // Redirect to home page on error
  },
};

// Type extensions for NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: string;
      twitterSubject?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: string;
    twitterSubject?: string;
  }
}
