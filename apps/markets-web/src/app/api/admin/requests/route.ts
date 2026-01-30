import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { Prisma } from "@vault/database";

// Valid sort fields
const validSortFields = ["createdAt", "status", "title"] as const;
type SortField = (typeof validSortFields)[number];

/**
 * GET /api/admin/requests
 * 
 * Get all market requests (admin only).
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10))
    );
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * pageSize;

    // Build where clause
    const whereClause: Record<string, unknown> = {};
    if (status) {
      whereClause.status = status;
    }
    if (search) {
      whereClause.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { handle: { contains: search, mode: "insensitive" } } },
      ];
    }

    // Build orderBy clause
    const orderByField = validSortFields.includes(sortBy as SortField) ? sortBy : "createdAt";
    const orderByDirection: Prisma.SortOrder = sortOrder === "asc" ? "asc" : "desc";
    const orderBy = { [orderByField]: orderByDirection };

    const [requests, total] = await Promise.all([
      prisma.marketRequest.findMany({
        where: whereClause,
        select: {
          id: true,
          title: true,
          description: true,
          sourceUrl: true,
          status: true,
          adminNotes: true,
          reviewedAt: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              handle: true,
              profileImageUrl: true,
            },
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              handle: true,
            },
          },
        },
        orderBy,
        skip,
        take: pageSize,
      }),
      prisma.marketRequest.count({
        where: whereClause,
      }),
    ]);

    return NextResponse.json({
      requests,
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
    console.error("Error fetching market requests:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
