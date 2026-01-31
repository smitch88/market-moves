import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@vault/auth";
import { prisma } from "@vault/database";
import { z } from "zod";

const claimCaptainSchema = z.object({
  kolId: z.string(),
  referralCode: z.string().optional(), // The KOL's referral code for attribution
});

/**
 * POST /api/captain/claim
 * Select a KOL as your captain
 * Also sets them as referrer if user has no referrer yet
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { kolId, referralCode } = claimCaptainSchema.parse(body);

    // Verify the KOL exists and is actually a KOL
    const kol = await prisma.user.findUnique({
      where: { id: kolId },
      select: {
        id: true,
        isKOL: true,
        referralCode: true,
        name: true,
        handle: true,
        profileImageUrl: true,
      },
    });

    if (!kol || !kol.isKOL) {
      return NextResponse.json(
        { error: "Selected user is not a valid KOL" },
        { status: 400 }
      );
    }

    // Can't select yourself as captain
    if (kol.id === user.id) {
      return NextResponse.json(
        { error: "You cannot select yourself as your captain" },
        { status: 400 }
      );
    }

    // Check if user already has a referrer
    const existingReferral = await prisma.referral.findFirst({
      where: { referredUserId: user.id },
    });

    // Use a transaction to update captain and potentially create referral
    await prisma.$transaction(async (tx) => {
      // Set captain
      await tx.user.update({
        where: { id: user.id },
        data: { captainId: kolId },
      });

      // If no existing referrer and the KOL's referral code matches, create referral
      if (!existingReferral && referralCode && referralCode === kol.referralCode) {
        await tx.referral.create({
          data: {
            referrerUserId: kolId,
            referredUserId: user.id,
          },
        });
      }
    });

    return NextResponse.json({
      success: true,
      captain: {
        id: kol.id,
        name: kol.name,
        handle: kol.handle,
        profileImageUrl: kol.profileImageUrl,
      },
      referralCreated: !existingReferral && referralCode === kol.referralCode,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error claiming captain:", error);
    return NextResponse.json(
      { error: "Failed to claim captain" },
      { status: 500 }
    );
  }
}
