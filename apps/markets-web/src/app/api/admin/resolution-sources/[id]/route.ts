import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction, Prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const updateSourceSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens").optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  type: z.enum(["INTERNAL", "EXTERNAL", "HYBRID"]).optional(),
  externalApiUrl: z.string().url().optional().or(z.literal("")).nullable(),
  externalApiHeaders: z.record(z.string()).optional().nullable(),
  logoUrl: z.string().url().optional().or(z.literal("")).nullable(),
  websiteUrl: z.string().url().optional().or(z.literal("")).nullable(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const source = await prisma.resolutionSource.findUnique({
      where: { id },
      include: {
        markets: {
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
        dataPoints: {
          orderBy: { effectiveAt: "desc" },
          take: 50,
        },
        _count: {
          select: {
            markets: true,
            dataPoints: true,
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json({ error: "Resolution source not found" }, { status: 404 });
    }

    return NextResponse.json({ source });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching resolution source:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = updateSourceSchema.parse(body);

    const source = await prisma.$transaction(async (tx) => {
      const existing = await tx.resolutionSource.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("Resolution source not found");
      }

      // Build update object explicitly to avoid Prisma type issues with spread operators
      const updateData: Parameters<typeof tx.resolutionSource.update>[0]["data"] = {};
      
      if (data.slug !== undefined) updateData.slug = data.slug;
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description || null;
      if (data.type !== undefined) updateData.type = data.type;
      if (data.externalApiUrl !== undefined) updateData.externalApiUrl = data.externalApiUrl || null;
      if (data.externalApiHeaders !== undefined) {
        updateData.externalApiHeaders = data.externalApiHeaders 
          ? (data.externalApiHeaders as Prisma.InputJsonValue)
          : Prisma.JsonNull;
      }
      if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl || null;
      if (data.websiteUrl !== undefined) updateData.websiteUrl = data.websiteUrl || null;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;
      if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

      const updated = await tx.resolutionSource.update({
        where: { id },
        data: updateData,
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.RESOLUTION_SOURCE_UPDATE,
          targetType: "ResolutionSource",
          targetId: id,
          metadata: {
            changes: data,
          },
        },
      });

      return updated;
    });

    return NextResponse.json({ source });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Resolution source not found") {
      return NextResponse.json({ error: "Resolution source not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A resolution source with this slug already exists" }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating resolution source:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.resolutionSource.findUnique({
        where: { id },
        include: {
          _count: {
            select: { markets: true },
          },
        },
      });

      if (!existing) {
        throw new Error("Resolution source not found");
      }

      // Prevent deletion if there are linked markets
      if (existing._count.markets > 0) {
        throw new Error("Cannot delete resolution source with linked markets");
      }

      // Delete all data points first
      await tx.resolutionDataPoint.deleteMany({
        where: { resolutionSourceId: id },
      });

      await tx.resolutionSource.delete({
        where: { id },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.RESOLUTION_SOURCE_UPDATE,
          targetType: "ResolutionSource",
          targetId: id,
          metadata: {
            action: "delete",
            slug: existing.slug,
            name: existing.name,
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Resolution source not found") {
      return NextResponse.json({ error: "Resolution source not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message.includes("Cannot delete")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error deleting resolution source:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
