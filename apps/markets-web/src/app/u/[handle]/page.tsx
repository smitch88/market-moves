import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { Header } from "@/components/layout/header";
import { PublicProfileContent } from "@/components/profile/public-profile-content";
import { ProfileSkeleton } from "@/components/profile/profile-skeleton";
import { prisma } from "@vault/database";

interface PageProps {
  params: Promise<{ handle: string }>;
}

// Helper to find user by handle or ID
async function findUser(identifier: string) {
  // Try by handle first (case-insensitive)
  let user = await prisma.user.findFirst({
    where: {
      handle: {
        equals: identifier,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      handle: true,
    },
  });

  // If not found, try by ID
  if (!user) {
    user = await prisma.user.findUnique({
      where: { id: identifier },
      select: {
        id: true,
        name: true,
        handle: true,
      },
    });
  }

  return user;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  
  const user = await findUser(handle);

  if (!user) {
    return {
      title: "User Not Found | Vault Markets",
    };
  }

  const displayName = user.name || user.handle || `User ${user.id.slice(0, 8)}`;
  const handleDisplay = user.handle ? `@${user.handle}` : user.id.slice(0, 8);
  
  return {
    title: `${displayName} (${handleDisplay}) | Vault Markets`,
    description: `View ${displayName}'s prediction market profile and trading activity on Vault Markets.`,
  };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { handle } = await params;

  // Check if user exists (by handle or ID)
  const user = await findUser(handle);

  if (!user) {
    notFound();
  }

  // Use the actual user ID for the content component
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={<ProfileSkeleton />}>
          <PublicProfileContent handle={user.id} />
        </Suspense>
      </main>
    </div>
  );
}
