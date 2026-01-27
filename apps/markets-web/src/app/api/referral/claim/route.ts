import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";

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

    // Find the referrer
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
    });

    if (!referrer) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
    }

    // Can't refer yourself
    if (referrer.id === dbUser.id) {
      return NextResponse.json({ error: "Cannot refer yourself" }, { status: 400 });
    }

    // Create the referral relationship
    await prisma.referral.create({
      data: {
        referrerUserId: referrer.id,
        referredUserId: dbUser.id,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Referral claimed successfully",
      referrer: {
        name: referrer.name,
        handle: referrer.handle,
      },
    });
  } catch (error) {
    console.error("Error claiming referral:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
