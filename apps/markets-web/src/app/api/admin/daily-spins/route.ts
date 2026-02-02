import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import { getAdminSpins, getSpinStats } from "@/lib/services/daily-spin-service";

/**
 * GET /api/admin/daily-spins
 * Get daily spins with pagination and filters, plus stats
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = Math.min(parseInt(searchParams.get("pageSize") || "50", 10), 100);
    const userId = searchParams.get("userId") || undefined;
    const dateFrom = searchParams.get("dateFrom") ? new Date(searchParams.get("dateFrom")!) : undefined;
    const dateTo = searchParams.get("dateTo") ? new Date(searchParams.get("dateTo")!) : undefined;
    const sortBy = (searchParams.get("sortBy") || "createdAt") as 'createdAt' | 'reward';
    const sortDir = (searchParams.get("sortDir") || "desc") as 'asc' | 'desc';
    const includeStats = searchParams.get("includeStats") !== "false";

    const [spinsData, stats] = await Promise.all([
      getAdminSpins({
        page,
        pageSize,
        userId,
        dateFrom,
        dateTo,
        sortBy,
        sortDir,
      }),
      includeStats ? getSpinStats() : null,
    ]);

    return NextResponse.json({
      ...spinsData,
      stats,
    });
  } catch (error) {
    console.error("Error fetching admin daily spins:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch daily spins" },
      { status: 500 }
    );
  }
}


