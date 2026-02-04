import { NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { prisma } from "@vault/database";

/**
 * GET /api/me/referral-stats
 * 
 * Returns statistics about the user's referrals, including
 * the total trading volume from all referred users.
 */
export async function GET() {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all referrals where this user is the referrer, including referred user data
    const referrals = await prisma.referral.findMany({
      where: { referrerUserId: user.id },
      include: {
        referred: {
          select: {
            id: true,
            handle: true,
            name: true,
            totalVolume: true,
            createdAt: true,
          },
        },
      },
    });

    // Calculate total volume from all referred users
    const totalReferredVolume = referrals.reduce((sum, referral) => {
      return sum + Number(referral.referred.totalVolume);
    }, 0);

    // Count qualified referrals (those that have placed a bet)
    const qualifiedCount = referrals.filter(r => r.qualifiedAt !== null).length;

    return NextResponse.json({
      totalReferrals: referrals.length,
      qualifiedReferrals: qualifiedCount,
      totalReferredVolume,
      referrals: referrals.map(r => ({
        id: r.id,
        userId: r.referred.id,
        handle: r.referred.handle,
        name: r.referred.name,
        volume: Number(r.referred.totalVolume),
        qualified: r.qualifiedAt !== null,
        joinedAt: r.createdAt,
      })),
    });
  } catch (error) {
    console.error("Error fetching referral stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}





