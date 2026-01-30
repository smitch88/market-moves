import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/resolution-sources/[slug]/data/[key]
 * 
 * Public endpoint to get a specific data point by key.
 * This is the primary endpoint for external systems to fetch resolution data.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; key: string }> }
) {
  try {
    const { slug, key } = await params;

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

    const dataPoint = await prisma.resolutionDataPoint.findFirst({
      where: {
        resolutionSourceId: source.id,
        key,
        isVerified: true,
        // Only show non-expired data points
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
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
            outcomes: true,
            event: {
              select: {
                slug: true,
                title: true,
              },
            },
          },
        },
      },
    });

    if (!dataPoint) {
      return NextResponse.json(
        { error: "Data point not found or not yet verified" },
        { status: 404 }
      );
    }

    const baseUrl = request.nextUrl.origin;

    // Parse value according to type
    let parsedValue: unknown = dataPoint.value;
    try {
      switch (dataPoint.valueType) {
        case "number":
          parsedValue = parseFloat(dataPoint.value);
          break;
        case "boolean":
          parsedValue = dataPoint.value.toLowerCase() === "true";
          break;
        case "json":
          parsedValue = JSON.parse(dataPoint.value);
          break;
        default:
          parsedValue = dataPoint.value;
      }
    } catch {
      parsedValue = dataPoint.value;
    }

    // Parse market outcomes if available
    let parsedOutcomes: string[] | null = null;
    if (dataPoint.market?.outcomes) {
      try {
        parsedOutcomes = JSON.parse(dataPoint.market.outcomes);
      } catch {
        parsedOutcomes = null;
      }
    }

    return NextResponse.json({
      source: {
        slug: source.slug,
        name: source.name,
        type: source.type,
      },
      data: {
        key: dataPoint.key,
        label: dataPoint.label,
        value: parsedValue,
        rawValue: dataPoint.value,
        valueType: dataPoint.valueType,
        effectiveAt: dataPoint.effectiveAt,
        expiresAt: dataPoint.expiresAt,
        verifiedAt: dataPoint.verifiedAt,
        metadata: dataPoint.metadata,
      },
      linkedMarket: dataPoint.market ? {
        id: dataPoint.market.id,
        question: dataPoint.market.question,
        status: dataPoint.market.status,
        resolvedOutcome: dataPoint.market.resolvedOutcome,
        outcomes: parsedOutcomes,
        eventSlug: dataPoint.market.event.slug,
        eventTitle: dataPoint.market.event.title,
        url: `${baseUrl}/events/${dataPoint.market.event.slug}`,
      } : null,
      meta: {
        apiVersion: "1.0",
        fetchedAt: new Date().toISOString(),
        sourceUrl: `${baseUrl}/api/resolution-sources/${source.slug}`,
      },
    });
  } catch (error) {
    console.error("Error fetching resolution data point:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
