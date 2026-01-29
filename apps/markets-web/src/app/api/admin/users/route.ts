import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "50", 10))
    );
    const role = searchParams.get("role");

    const skip = (page - 1) * pageSize;

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: {
          ...(role && { role: role as never }),
        },
        select: {
          id: true,
          email: true,
          handle: true,
          name: true,
          role: true,
          balance: true,
          xp: true,
          createdAt: true,
          _count: {
            select: {
              bets: { where: { status: "CONFIRMED" } },
              positions: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.user.count({
        where: {
          ...(role && { role: role as never }),
        },
      }),
    ]);

    return NextResponse.json({
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
