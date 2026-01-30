import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction, Prisma } from "@vault/database";
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

      // Build update object explicitly to avoid Prisma type issues with spread operators
      const updateData: Parameters<typeof tx.resolutionDataPoint.update>[0]["data"] = {};
      
      if (data.key !== undefined) updateData.key = data.key;
      if (data.label !== undefined) updateData.label = data.label;
      if (data.value !== undefined) updateData.value = data.value;
      if (data.valueType !== undefined) updateData.valueType = data.valueType;
      if (data.marketId !== undefined) updateData.marketId = data.marketId;
      if (data.externalValue !== undefined) updateData.externalValue = data.externalValue;
      if (data.metadata !== undefined) {
        updateData.metadata = data.metadata === null 
          ? Prisma.JsonNull 
          : (data.metadata as Prisma.InputJsonValue);
      }
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.effectiveAt !== undefined) updateData.effectiveAt = new Date(data.effectiveAt);
      if (data.expiresAt !== undefined) updateData.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;
      if (data.isVerified !== undefined) {
        updateData.isVerified = data.isVerified;
        if (isVerifying) {
          updateData.verifiedAt = new Date();
          updateData.verifiedBy = admin.id;
        }
      }

      const updated = await tx.resolutionDataPoint.update({
        where: { id: dataId },
        data: updateData,
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: isVerifying ? AdminAction.RESOLUTION_DATA_VERIFY : AdminAction.RESOLUTION_DATA_UPDATE,
          targetType: "ResolutionDataPoint",
          targetId: dataId,
          metadata: {
            sourceId: id,
            changes: JSON.parse(JSON.stringify(data)),
          } as Prisma.InputJsonValue,
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
