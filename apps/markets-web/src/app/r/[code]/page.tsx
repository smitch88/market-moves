import { notFound } from "next/navigation";
import { prisma } from "@vault/database";
import { ReferralJoin } from "@/components/referral/referral-join";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ code: string }>;
}

// Helper to find referrer by handle first, then by referral code
async function findReferrer(code: string) {
  // First try to find by handle (case-insensitive) - users with handles always have referral codes
  let referrer = await prisma.user.findFirst({
    where: { 
      handle: { equals: code, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      handle: true,
      profileImageUrl: true,
      bannerImageUrl: true,
      referralCode: true,
    },
  });

  // Fall back to referral code lookup
  if (!referrer) {
    referrer = await prisma.user.findUnique({
      where: { referralCode: code },
      select: {
        id: true,
        name: true,
        handle: true,
        profileImageUrl: true,
        bannerImageUrl: true,
        referralCode: true,
      },
    });
  }

  return referrer;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const referrer = await findReferrer(code);

  const referrerName = referrer?.name || referrer?.handle || "A friend";
  const handleDisplay = referrer?.handle ? `@${referrer.handle}` : "";
  
  const title = `Join Vault Markets | Invited by ${referrerName}`;
  const description = `${referrerName}${handleDisplay ? ` (${handleDisplay})` : ""} invited you to join Vault Markets! Start with $10,000 virtual credits and trade on real-world outcomes across sports, crypto, politics & more.`;

  return {
    title,
    description,
    openGraph: {
      type: "website",
      title: `${referrerName} invited you to Vault Markets`,
      description,
      siteName: "Vault777 Markets",
    },
    twitter: {
      card: "summary_large_image",
      title: `${referrerName} invited you to Vault Markets`,
      description,
    },
  };
}

export default async function ReferralPage({ params }: PageProps) {
  const { code } = await params;

  const referrer = await findReferrer(code);

  if (!referrer || !referrer.referralCode) {
    notFound();
  }

  return <ReferralJoin referrer={referrer} referralCode={referrer.referralCode} />;
}
