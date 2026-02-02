import { NextRequest, NextResponse } from "next/server";
import { prisma, XPReason } from "@vault/database";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { calculateLevel } from "@/lib/services/xp-service";

// XP bonus for referrals - equivalent to a $1,000 bet at 10 XP per dollar
const REFERRAL_XP_BONUS = 10000;

// Referral claim window - users can only claim referrals within 7 days of account creation
// This prevents gaming by having existing users claim referrals retroactively
const REFERRAL_CLAIM_WINDOW_DAYS = 7;

export async function POST(request: NextRequest) {
  try {
    const user = await getEffectiveUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { referralCode } = await request.json();

    if (!referralCode) {
      return NextResponse.json({ error: "Referral code required" }, { status: 400 });
    }

    // Find the database user with referral info
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { referralReceived: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if user already has a referral
    if (dbUser.referralReceived) {
      return NextResponse.json({ 
        success: false, 
        message: "Already referred by someone" 
      });
    }

    // Check if user's account is too old to claim a referral
    // This prevents existing users from gaming the system retroactively
    const accountAgeMs = Date.now() - new Date(dbUser.createdAt).getTime();
    const claimWindowMs = REFERRAL_CLAIM_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (accountAgeMs > claimWindowMs) {
      console.warn(`Referral claim rejected: Account too old. User ${dbUser.id} created ${Math.floor(accountAgeMs / (24 * 60 * 60 * 1000))} days ago`);
      return NextResponse.json({ 
        success: false, 
        message: "Referral window expired" 
      });
    }

    // Find the referrer by handle first (case-insensitive), then by referral code
    // Users with handles always have referral codes
    let referrer = await prisma.user.findFirst({
      where: { 
        handle: { equals: referralCode, mode: "insensitive" },
      },
    });

    // Fall back to referral code lookup
    if (!referrer) {
      referrer = await prisma.user.findUnique({
        where: { referralCode },
      });
    }

    if (!referrer) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
    }

    // Can't refer yourself
    if (referrer.id === dbUser.id) {
      return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
    }

    // Create the referral relationship and award XP to both users in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the referral relationship
      const referralRecord = await tx.referral.create({
        data: {
          referrerUserId: referrer.id,
          referredUserId: dbUser.id,
        },
      });

      // Award XP to the referred user (new user)
      const updatedReferredUser = await tx.user.update({
        where: { id: dbUser.id },
        data: { xp: { increment: REFERRAL_XP_BONUS } },
        select: { xp: true },
      });

      // Create XP ledger entry for referred user
      await tx.xPLedger.create({
        data: {
          userId: dbUser.id,
          delta: REFERRAL_XP_BONUS,
          xpBefore: updatedReferredUser.xp - REFERRAL_XP_BONUS,
          xpAfter: updatedReferredUser.xp,
          reason: XPReason.REFERRAL_BONUS,
          correlationId: `referral:${referralRecord.id}:referred`,
        },
      });

      // Award XP to the referrer
      const updatedReferrer = await tx.user.update({
        where: { id: referrer.id },
        data: { xp: { increment: REFERRAL_XP_BONUS } },
        select: { xp: true },
      });

      // Create XP ledger entry for referrer
      await tx.xPLedger.create({
        data: {
          userId: referrer.id,
          delta: REFERRAL_XP_BONUS,
          xpBefore: updatedReferrer.xp - REFERRAL_XP_BONUS,
          xpAfter: updatedReferrer.xp,
          reason: XPReason.REFERRAL_BONUS,
          correlationId: `referral:${referralRecord.id}:referrer`,
        },
      });

      return {
        referredUserXp: updatedReferredUser.xp,
        referrerXp: updatedReferrer.xp,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Referral claimed successfully",
      referrer: {
        name: referrer.name,
        handle: referrer.handle,
      },
      xpAwarded: REFERRAL_XP_BONUS,
      newXp: result.referredUserXp,
      newLevel: calculateLevel(result.referredUserXp),
    });
  } catch (error) {
    console.error("Error claiming referral:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
