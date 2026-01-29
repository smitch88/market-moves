import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/events/[id]/publish
 * Toggle the isPublished status of an event and its markets
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const { isPublished } = body as { isPublished: boolean };

    if (typeof isPublished !== "boolean") {
      return NextResponse.json(
        { error: "isPublished must be a boolean" },
        { status: 400 }
      );
    }

    // Get the event
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        markets: {
          select: { id: true },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Update event and cascade to markets if unpublishing
    const result = await prisma.$transaction(async (tx) => {
      // Update the event
      const updatedEvent = await tx.event.update({
        where: { id },
        data: { isPublished },
      });

      // If unpublishing, also unpublish all markets
      if (!isPublished) {
        await tx.market.updateMany({
          where: { eventId: id },
          data: { isPublished: false },
        });
      }

      // Log admin action
      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: "EVENT_UPDATE",
          targetType: "Event",
          targetId: id,
          metadata: {
            action: isPublished ? "publish" : "unpublish",
            marketCount: event.markets.length,
            cascadeToMarkets: !isPublished,
          },
        },
      });

      return updatedEvent;
    });

    return NextResponse.json({
      success: true,
      event: result,
      message: isPublished
        ? `Event "${result.title}" is now published`
        : `Event "${result.title}" and its ${event.markets.length} market(s) are now unpublished`,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error toggling event publish status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
