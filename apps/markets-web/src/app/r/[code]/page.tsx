import { notFound } from "next/navigation";
import { prisma } from "@vault/database";
import { ReferralJoin } from "@/components/referral/referral-join";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: { name: true, handle: true },
  });

  const referrerName = referrer?.name || referrer?.handle || "A friend";

  return {
    title: `Join Vault Markets | Invited by ${referrerName}`,
    description: "Join the future of prediction markets. Trade on real-world outcomes with virtual credits.",
    openGraph: {
      title: `${referrerName} invited you to Vault Markets`,
      description: "Join the future of prediction markets. Trade on real-world outcomes with virtual credits.",
    },
  };
}

export default async function ReferralPage({ params }: PageProps) {
  const { code } = await params;

  const referrer = await prisma.user.findUnique({
    where: { referralCode: code },
    select: {
      id: true,
      name: true,
      handle: true,
      profileImageUrl: true,
    },
  });

  if (!referrer) {
    notFound();
  }

  return <ReferralJoin referrer={referrer} referralCode={code} />;
}
