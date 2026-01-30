import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/resolution-sources/[slug]/data
 * 
 * Public endpoint to get all verified data points for a resolution source.
 * Supports filtering by key, market, and effective date.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    
    const key = searchParams.get("key");
    const marketId = searchParams.get("marketId");
    const since = searchParams.get("since"); // ISO date string
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

    // First verify the source exists and is public
    const source = await prisma.resolutionSource.findFirst({
      where: {
        slug,
        isActive: true,
        isPublic: true,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Resolution source not found" },
        { status: 404 }
      );
    }

    const dataPoints = await prisma.resolutionDataPoint.findMany({
      where: {
        resolutionSourceId: source.id,
        isVerified: true,
        // Only show non-expired data points
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
        ...(key && { key }),
        ...(marketId && { marketId }),
        ...(since && { effectiveAt: { gte: new Date(since) } }),
      },
      select: {
        id: true,
        key: true,
        label: true,
        value: true,
        valueType: true,
        effectiveAt: true,
        expiresAt: true,
        verifiedAt: true,
        metadata: true,
        market: {
          select: {
            id: true,
            question: true,
            status: true,
            resolvedOutcome: true,
            event: {
              select: {
                slug: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { effectiveAt: "desc" },
      take: limit,
    });

    const baseUrl = request.nextUrl.origin;

    // Parse values according to their type
    const parsedDataPoints = dataPoints.map((dp) => {
      let parsedValue: unknown = dp.value;
      
      try {
        switch (dp.valueType) {
          case "number":
            parsedValue = parseFloat(dp.value);
            break;
          case "boolean":
            parsedValue = dp.value.toLowerCase() === "true";
            break;
          case "json":
            parsedValue = JSON.parse(dp.value);
            break;
          default:
            parsedValue = dp.value;
        }
      } catch {
        // Keep original string value if parsing fails
        parsedValue = dp.value;
      }

      return {
        key: dp.key,
        label: dp.label,
        value: parsedValue,
        rawValue: dp.value,
        valueType: dp.valueType,
        effectiveAt: dp.effectiveAt,
        expiresAt: dp.expiresAt,
        verifiedAt: dp.verifiedAt,
        metadata: dp.metadata,
        linkedMarket: dp.market ? {
          id: dp.market.id,
          question: dp.market.question,
          status: dp.market.status,
          resolvedOutcome: dp.market.resolvedOutcome,
          eventSlug: dp.market.event.slug,
          eventTitle: dp.market.event.title,
          url: `${baseUrl}/events/${dp.market.event.slug}`,
        } : null,
      };
    });

    return NextResponse.json({
      source: {
        slug: source.slug,
        name: source.name,
        type: source.type,
      },
      dataPoints: parsedDataPoints,
      meta: {
        total: parsedDataPoints.length,
        limit,
        apiVersion: "1.0",
        fetchedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching resolution data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
