import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction, Prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const createDataPointSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_-]+$/, "Key must be lowercase alphanumeric with underscores/hyphens"),
  label: z.string().optional(),
  value: z.string().min(1),
  valueType: z.enum(["string", "number", "boolean", "json"]).default("string"),
  marketId: z.string().optional(),
  externalValue: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  effectiveAt: z.string().optional(), // ISO date string
  expiresAt: z.string().optional(), // ISO date string
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    
    const key = searchParams.get("key");
    const marketId = searchParams.get("marketId");
    const verified = searchParams.get("verified");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

    const dataPoints = await prisma.resolutionDataPoint.findMany({
      where: {
        resolutionSourceId: id,
        ...(key && { key }),
        ...(marketId && { marketId }),
        ...(verified === "true" && { isVerified: true }),
        ...(verified === "false" && { isVerified: false }),
      },
      include: {
        market: {
          select: {
            id: true,
            question: true,
            status: true,
            event: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: { effectiveAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ dataPoints });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching data points:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = createDataPointSchema.parse(body);

    const dataPoint = await prisma.$transaction(async (tx) => {
      // Verify the resolution source exists
      const source = await tx.resolutionSource.findUnique({
        where: { id },
      });

      if (!source) {
        throw new Error("Resolution source not found");
      }

      // If marketId provided, verify market exists
      if (data.marketId) {
        const market = await tx.market.findUnique({
          where: { id: data.marketId },
        });
        if (!market) {
          throw new Error("Market not found");
        }
      }

      const newDataPoint = await tx.resolutionDataPoint.create({
        data: {
          resolutionSourceId: id,
          key: data.key,
          label: data.label || null,
          value: data.value,
          valueType: data.valueType,
          marketId: data.marketId || null,
          externalValue: data.externalValue || null,
          metadata: data.metadata 
            ? (data.metadata as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          notes: data.notes || null,
          effectiveAt: data.effectiveAt ? new Date(data.effectiveAt) : new Date(),
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.RESOLUTION_DATA_CREATE,
          targetType: "ResolutionDataPoint",
          targetId: newDataPoint.id,
          metadata: {
            sourceId: id,
            key: data.key,
            value: data.value,
            marketId: data.marketId,
          },
        },
      });

      return newDataPoint;
    });

    return NextResponse.json({ dataPoint });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Resolution source not found") {
      return NextResponse.json({ error: "Resolution source not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "Market not found") {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A data point with this key already exists for this source" }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating data point:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
