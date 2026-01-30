import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";

/**
 * GET /api/resolution-sources/[slug]
 * 
 * Public endpoint to get details about a specific resolution source.
 * Returns source information and recent verified data points.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

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
        description: true,
        type: true,
        logoUrl: true,
        websiteUrl: true,
        createdAt: true,
        updatedAt: true,
        dataPoints: {
          where: {
            isVerified: true,
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
            market: {
              select: {
                id: true,
                question: true,
                status: true,
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
          take: 100,
        },
        markets: {
          where: { isPublished: true },
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
          take: 50,
        },
        _count: {
          select: {
            markets: { where: { isPublished: true } },
            dataPoints: { where: { isVerified: true } },
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json(
        { error: "Resolution source not found" },
        { status: 404 }
      );
    }

    const baseUrl = request.nextUrl.origin;

    return NextResponse.json({
      source: {
        id: source.id,
        slug: source.slug,
        name: source.name,
        description: source.description,
        type: source.type,
        logoUrl: source.logoUrl,
        websiteUrl: source.websiteUrl,
        createdAt: source.createdAt,
        updatedAt: source.updatedAt,
        marketCount: source._count.markets,
        verifiedDataPointCount: source._count.dataPoints,
      },
      dataPoints: source.dataPoints.map((dp) => ({
        ...dp,
        apiUrl: `${baseUrl}/api/resolution-sources/${source.slug}/data/${dp.key}`,
      })),
      linkedMarkets: source.markets.map((m) => ({
        ...m,
        marketUrl: `${baseUrl}/events/${m.event.slug}`,
      })),
      meta: {
        apiVersion: "1.0",
        dataUrl: `${baseUrl}/api/resolution-sources/${source.slug}/data`,
      },
    });
  } catch (error) {
    console.error("Error fetching resolution source:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
