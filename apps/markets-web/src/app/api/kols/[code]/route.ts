import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/kols/[code]
 * Get KOL information by their referral code
 * Used for captain selection pages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    // Find user by referral code who is also a KOL
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
            followers: true, // Users who have this KOL as captain
          },
        },
      },
    });

    if (!kol) {
      return NextResponse.json(
        { error: "KOL not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      kol: {
        id: kol.id,
        name: kol.name,
        handle: kol.handle,
        profileImageUrl: kol.profileImageUrl,
        referralCode: kol.referralCode,
        followerCount: kol._count.followers,
      },
    });
  } catch (error) {
    console.error("Error fetching KOL:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOL" },
      { status: 500 }
    );
  }
}
