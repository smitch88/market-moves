import { notFound } from "next/navigation";
import { prisma } from "@vault/database";
import { CaptainJoin } from "@/components/captain";

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { code } = await params;
  
  const kol = await prisma.user.findFirst({
    where: {
      referralCode: code,
      isKOL: true,
    },
    select: {
      name: true,
      handle: true,
    },
  });

  if (!kol) {
    return {
      title: "Captain Not Found | Vault Markets",
    };
  }

  const name = kol.name || kol.handle || "Captain";
  return {
    title: `Join ${name}'s Team | Vault Markets`,
    description: `Select ${name} as your captain on Vault Markets and compete together!`,
  };
}

export default async function CaptainPage({ params }: PageProps) {
  const { code } = await params;

  // Find KOL by referral code
  const kol = await prisma.user.findFirst({
    where: {
      referralCode: code,
      isKOL: true,
    },
    select: {
      id: true,
      name: true,
      handle: true,
      profileImageUrl: true,
      referralCode: true,
      _count: {
        select: {
          followers: true,
        },
      },
    },
  });

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
