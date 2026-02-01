import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/markets/[id]/publish
 * Toggle the isPublished status of a market
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

    // Get the market with its event
    const market = await prisma.market.findUnique({
      where: { id },
      include: {
        event: {
          select: { id: true, title: true, isPublished: true },
        },
      },
    });

    if (!market) {
      return NextResponse.json({ error: "Market not found" }, { status: 404 });
    }

    // Update the market (and event if needed)
    const result = await prisma.$transaction(async (tx) => {
      // If publishing market and parent event is unpublished, publish the event too
      let eventPublished = false;
      if (isPublished && !market.event.isPublished) {
        await tx.event.update({
          where: { id: market.event.id },
          data: { isPublished: true },
        });
        eventPublished = true;

        // Log event publish action
        await tx.adminActionLog.create({
          data: {
            adminUserId: admin.id,
            action: "EVENT_UPDATE",
            targetType: "Event",
            targetId: market.event.id,
            metadata: {
              action: "publish",
              title: market.event.title,
              reason: "Auto-published with market",
            },
          },
        });
      }

      const updatedMarket = await tx.market.update({
        where: { id },
        data: {
          isPublished,
          // When publishing, set status to OPEN so users can bet
          // When unpublishing, revert to DRAFT
          status: isPublished ? "OPEN" : "DRAFT",
        },
      });

      // Log admin action
      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: "MARKET_UPDATE",
          targetType: "Market",
          targetId: id,
          metadata: {
            action: isPublished ? "publish" : "unpublish",
            question: market.question,
          },
        },
      });

      return { updatedMarket, eventPublished };
    });

    return NextResponse.json({
      success: true,
      market: result.updatedMarket,
      eventPublished: result.eventPublished,
      message: isPublished
        ? result.eventPublished
          ? `Market and parent event are now published`
          : `Market is now published`
        : `Market is now unpublished`,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error toggling market publish status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
