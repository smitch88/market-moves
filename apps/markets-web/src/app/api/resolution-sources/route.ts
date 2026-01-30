import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/resolution-sources
 * 
 * Public endpoint to list all active, public resolution sources.
 * This serves as the index of all resolution authorities available on Vault Markets.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");

    const sources = await prisma.resolutionSource.findMany({
      where: {
        isActive: true,
        isPublic: true,
        ...(type && { type: type as "INTERNAL" | "EXTERNAL" | "HYBRID" }),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        type: true,
        logoUrl: true,
        websiteUrl: true,
        createdAt: true,
        _count: {
          select: {
            markets: { where: { isPublished: true } },
            dataPoints: { where: { isVerified: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // Build public API URLs
    const baseUrl = request.nextUrl.origin;
    const sourcesWithUrls = sources.map((source) => ({
      ...source,
      apiUrl: `${baseUrl}/api/resolution-sources/${source.slug}`,
      dataUrl: `${baseUrl}/api/resolution-sources/${source.slug}/data`,
      marketCount: source._count.markets,
      verifiedDataPointCount: source._count.dataPoints,
      _count: undefined,
    }));

    return NextResponse.json({
      sources: sourcesWithUrls,
      meta: {
        total: sourcesWithUrls.length,
        apiVersion: "1.0",
        documentation: `${baseUrl}/docs/api#resolution-sources`,
      },
    });
  } catch (error) {
    console.error("Error fetching resolution sources:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
