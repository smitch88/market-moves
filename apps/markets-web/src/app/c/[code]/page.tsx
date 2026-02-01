import { notFound } from "next/navigation";
import { prisma } from "@vault/database";
import { CaptainJoin } from "@/components/captain";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ code: string }>;
}

// Helper to find captain by handle first, then by referral code
async function findCaptain(code: string) {
  // First try to find by handle (case-insensitive)
  let kol = await prisma.user.findFirst({
    where: {
      handle: { equals: code, mode: "insensitive" },
      isKOL: true,
    },
    select: {
      id: true,
      name: true,
      handle: true,
      profileImageUrl: true,
      bannerImageUrl: true,
      referralCode: true,
      _count: {
        select: {
          followers: true,
        },
      },
    },
  });

  // Fall back to referral code lookup
  if (!kol) {
    kol = await prisma.user.findFirst({
      where: {
        referralCode: code,
        isKOL: true,
      },
      select: {
        id: true,
        name: true,
        handle: true,
        profileImageUrl: true,
        bannerImageUrl: true,
        referralCode: true,
        _count: {
          select: {
            followers: true,
          },
        },
      },
    });
  }

  return kol;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  
  const kol = await findCaptain(code);

  if (!kol) {
    return {
      title: "Captain Not Found | Vault Markets",
    };
  }

  const name = kol.name || kol.handle || "Captain";
  const handleDisplay = kol.handle ? `@${kol.handle}` : "";
  const followerCount = kol._count.followers;
  
  const title = `Join ${name}'s Team | Vault Markets`;
  const description = `${name}${handleDisplay ? ` (${handleDisplay})` : ""} is a Captain on Vault Markets${followerCount > 0 ? ` with ${followerCount} team member${followerCount !== 1 ? "s" : ""}` : ""}. Join their team and compete together!`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title: `Join ${name}'s Team on Vault Markets`,
      description,
      siteName: "Vault777 Markets",
    },
    twitter: {
      card: "summary_large_image",
      title: `Join ${name}'s Team on Vault Markets`,
      description,
    },
  };
}

export default async function CaptainPage({ params }: PageProps) {
  const { code } = await params;

  const kol = await findCaptain(code);

  if (!kol) {
    notFound();
  }

  return (
    <CaptainJoin
      kol={{
        id: kol.id,
        name: kol.name,
        handle: kol.handle,
        profileImageUrl: kol.profileImageUrl,
        referralCode: kol.referralCode,
        followerCount: kol._count.followers,
      }}
    />
  );
}
