import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/kols/[code]
 * Get KOL information by their handle or referral code
 * Used for captain selection pages
 * Supports both /api/kols/username and /api/kols/abc123referralcode
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

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
        referralCode: true,
        _count: {
          select: {
            followers: true, // Users who have this KOL as captain
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
          referralCode: true,
          _count: {
            select: {
              followers: true,
            },
          },
        },
      });
    }

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
