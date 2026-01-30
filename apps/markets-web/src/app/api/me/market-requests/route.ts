import { NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { prisma } from "@vault/database";

/**
 * GET /api/me/market-requests
 * 
 * Get all market requests for the current user.
 */
export async function GET() {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await prisma.marketRequest.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        title: true,
        description: true,
        sourceUrl: true,
        status: true,
        adminNotes: true,
        reviewedAt: true,
        createdAt: true,
        reviewer: {
          select: {
            name: true,
            handle: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching market requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
