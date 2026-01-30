import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const updateDataPointSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_-]+$/, "Key must be lowercase alphanumeric with underscores/hyphens").optional(),
  label: z.string().optional().nullable(),
  value: z.string().min(1).optional(),
  valueType: z.enum(["string", "number", "boolean", "json"]).optional(),
  marketId: z.string().optional().nullable(),
  externalValue: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).optional().nullable(),
  notes: z.string().optional().nullable(),
  effectiveAt: z.string().optional(),
  expiresAt: z.string().optional().nullable(),
  isVerified: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dataId: string }> }
) {
  try {
    await requireAdmin();
    const { id, dataId } = await params;

    const dataPoint = await prisma.resolutionDataPoint.findFirst({
      where: {
        id: dataId,
        resolutionSourceId: id,
      },
      include: {
        resolutionSource: {
          select: {
            id: true,
            slug: true,
            name: true,
            type: true,
          },
        },
        market: {
          select: {
            id: true,
            question: true,
            status: true,
            event: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!dataPoint) {
      return NextResponse.json({ error: "Data point not found" }, { status: 404 });
    }

    return NextResponse.json({ dataPoint });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching data point:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dataId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id, dataId } = await params;
    const body = await request.json();
    const data = updateDataPointSchema.parse(body);

    const dataPoint = await prisma.$transaction(async (tx) => {
      const existing = await tx.resolutionDataPoint.findFirst({
        where: {
          id: dataId,
          resolutionSourceId: id,
        },
      });

      if (!existing) {
        throw new Error("Data point not found");
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

      const isVerifying = data.isVerified === true && !existing.isVerified;

      const updated = await tx.resolutionDataPoint.update({
        where: { id: dataId },
        data: {
          ...(data.key !== undefined && { key: data.key }),
          ...(data.label !== undefined && { label: data.label }),
          ...(data.value !== undefined && { value: data.value }),
          ...(data.valueType !== undefined && { valueType: data.valueType }),
          ...(data.marketId !== undefined && { marketId: data.marketId }),
          ...(data.externalValue !== undefined && { externalValue: data.externalValue }),
          ...(data.metadata !== undefined && { metadata: data.metadata }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.effectiveAt !== undefined && { effectiveAt: new Date(data.effectiveAt) }),
          ...(data.expiresAt !== undefined && { expiresAt: data.expiresAt ? new Date(data.expiresAt) : null }),
          ...(data.isVerified !== undefined && { 
            isVerified: data.isVerified,
            ...(isVerifying && { 
              verifiedAt: new Date(),
              verifiedBy: admin.id,
            }),
          }),
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: isVerifying ? AdminAction.RESOLUTION_DATA_VERIFY : AdminAction.RESOLUTION_DATA_UPDATE,
          targetType: "ResolutionDataPoint",
          targetId: dataId,
          metadata: {
            sourceId: id,
            changes: data,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ dataPoint });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Data point not found") {
      return NextResponse.json({ error: "Data point not found" }, { status: 404 });
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
    console.error("Error updating data point:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dataId: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id, dataId } = await params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.resolutionDataPoint.findFirst({
        where: {
          id: dataId,
          resolutionSourceId: id,
        },
      });

      if (!existing) {
        throw new Error("Data point not found");
      }

      await tx.resolutionDataPoint.delete({
        where: { id: dataId },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.RESOLUTION_DATA_UPDATE,
          targetType: "ResolutionDataPoint",
          targetId: dataId,
          metadata: {
            action: "delete",
            sourceId: id,
            key: existing.key,
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Data point not found") {
      return NextResponse.json({ error: "Data point not found" }, { status: 404 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting data point:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
