import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const updateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  active: z.boolean().optional(),
  closed: z.boolean().optional(),
  tagIds: z.array(z.string()).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        tags: true,
        markets: {
          include: {
            bets: {
              where: { status: "CONFIRMED" },
              orderBy: { createdAt: "desc" },
              take: 50,
              include: {
                user: {
                  select: {
                    id: true,
                    handle: true,
                    name: true,
                  },
                },
              },
            },
            positions: {
              include: {
                user: {
                  select: {
                    id: true,
                    handle: true,
                    name: true,
                  },
                },
              },
            },
            _count: {
              select: { bets: true },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching event:", error);
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
    const data = updateEventSchema.parse(body);

    const event = await prisma.$transaction(async (tx) => {
      const updatedEvent = await tx.event.update({
        where: { id },
        data: {
          ...(data.title && { title: data.title }),
          ...(data.description !== undefined && { description: data.description || null }),
          ...(data.category && { category: data.category as never }),
          ...(data.bannerUrl !== undefined && { bannerUrl: data.bannerUrl || null }),
          ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl || null }),
          ...(data.startTime !== undefined && { startTime: data.startTime ? new Date(data.startTime) : null }),
          ...(data.endTime !== undefined && { endTime: data.endTime ? new Date(data.endTime) : null }),
          ...(data.active !== undefined && { active: data.active }),
          ...(data.closed !== undefined && { closed: data.closed }),
          ...(data.tagIds && { tags: { set: data.tagIds.map((tagId) => ({ id: tagId })) } }),
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.EVENT_UPDATE,
          targetType: "Event",
          targetId: id,
          metadata: data,
        },
      });

      return tx.event.findUnique({
        where: { id },
        include: { markets: true, tags: true },
      });
    });

    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
