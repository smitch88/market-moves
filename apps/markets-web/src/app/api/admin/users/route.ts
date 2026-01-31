import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { Prisma } from "@vault/database";

// Valid sort fields
const validSortFields = ["createdAt", "balance", "xp", "name"] as const;
type SortField = (typeof validSortFields)[number];

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
    const isKOL = searchParams.get("isKOL");
    const search = searchParams.get("search")?.trim();
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * pageSize;

    // Build where clause with search
    const whereClause: Record<string, unknown> = {};
    if (role) {
      whereClause.role = role;
    }
    if (isKOL === "true") {
      whereClause.isKOL = true;
    }
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { handle: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { twitterSubject: { contains: search } },
      ];
    }

    // Build orderBy clause
    const orderByField = validSortFields.includes(sortBy as SortField) ? sortBy : "createdAt";
    const orderByDirection: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";
    const orderBy = { [orderByField]: orderByDirection };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where: whereClause,
        select: {
          id: true,
          email: true,
          handle: true,
          name: true,
          role: true,
          balance: true,
          xp: true,
          twitterSubject: true,
          profileImageUrl: true,
          isKOL: true,
          kolApprovedAt: true,
          createdAt: true,
          _count: {
            select: {
              bets: { where: { status: "CONFIRMED" } },
              positions: true,
              followers: true,
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.user.count({
        where: whereClause,
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
