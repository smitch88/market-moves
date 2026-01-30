import { NextRequest, NextResponse } from "next/server";
import { prisma, MarketStatus, AdminAction } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const createEventSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  category: z.string().default("OTHER"),
  eventType: z.string().default("PROP"),
  bannerUrl: z.string().url().optional().or(z.literal("")),
  logoUrl: z.string().url().optional().or(z.literal("")),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  tagIds: z.array(z.string()).optional(),
  // New tags to create and associate with the event
  newTags: z.array(z.object({
    label: z.string().min(1),
    slug: z.string().min(1).optional(), // Will be auto-generated if not provided
  })).optional(),
  // Markets to create with the event (optional - can create event first, then add markets)
  markets: z.array(z.object({
    question: z.string().min(1),
    outcomes: z.array(z.string()).length(2),
    outcomeColors: z.array(z.string()).length(2).optional(),
    detailsMarkdown: z.string().optional(),
    resolutionSourceUrl: z.string().url().optional().or(z.literal("")),
    opensAt: z.string().nullable().optional(),
    closesAt: z.string().nullable().optional(),
    feeBps: z.number().int().min(0).max(10000).default(100),
    seed0: z.number().int().min(0).default(1000),
    seed1: z.number().int().min(0).default(1000),
  })).optional().default([]),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const category = searchParams.get("category");

    const events = await prisma.event.findMany({
      where: {
        ...(category && { category: category as never }),
      },
      include: {
        tags: true,
        markets: {
          select: {
            id: true,
            question: true,
            status: true,
            closesAt: true,
            _count: {
              select: { bets: { where: { status: "CONFIRMED" } } },
            },
          },
        },
        _count: {
          select: { markets: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ events });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching events:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const data = createEventSchema.parse(body);

    const event = await prisma.$transaction(async (tx) => {
      // Create new tags if provided
      const createdTagIds: string[] = [];
      if (data.newTags && data.newTags.length > 0) {
        for (const newTag of data.newTags) {
          // Generate slug if not provided
          const tagSlug = newTag.slug || newTag.label
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
          
          // Check if tag already exists
          const existingTag = await tx.tag.findUnique({
            where: { slug: tagSlug },
          });
          
          if (existingTag) {
            createdTagIds.push(existingTag.id);
          } else {
            const createdTag = await tx.tag.create({
              data: {
                slug: tagSlug,
                label: newTag.label,
              },
            });
            createdTagIds.push(createdTag.id);
          }
        }
      }

      // Combine existing tag IDs with newly created tag IDs
      const allTagIds = [
        ...(data.tagIds || []),
        ...createdTagIds,
      ];

      // Create event
      const newEvent = await tx.event.create({
        data: {
          title: data.title,
          slug: data.slug,
          description: data.description || null,
          category: data.category as never,
          eventType: data.eventType as never,
          bannerUrl: data.bannerUrl || null,
          logoUrl: data.logoUrl || null,
          startTime: data.startTime ? new Date(data.startTime) : null,
          endTime: data.endTime ? new Date(data.endTime) : null,
          ...(allTagIds.length > 0 && {
            tags: { connect: allTagIds.map((id) => ({ id })) },
          }),
        },
      });

      // Create markets for this event (if any provided)
      if (data.markets && data.markets.length > 0) {
        for (const marketData of data.markets) {
          await tx.market.create({
            data: {
              eventId: newEvent.id,
              question: marketData.question,
              outcomes: JSON.stringify(marketData.outcomes),
              outcomePrices: JSON.stringify(["0.50", "0.50"]),
              detailsMarkdown: marketData.detailsMarkdown || null,
              resolutionSourceUrl: marketData.resolutionSourceUrl || null,
              opensAt: marketData.opensAt ? new Date(marketData.opensAt) : null,
              closesAt: marketData.closesAt ? new Date(marketData.closesAt) : null,
              feeBps: marketData.feeBps,
              seed0: marketData.seed0,
              seed1: marketData.seed1,
              status: MarketStatus.DRAFT,
            },
          });
        }
      }

      // Log admin action
      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.EVENT_CREATE,
          targetType: "Event",
          targetId: newEvent.id,
          metadata: { 
            title: data.title, 
            slug: data.slug,
            marketCount: data.markets?.length || 0,
            tagCount: allTagIds.length,
          },
        },
      });

      return tx.event.findUnique({
        where: { id: newEvent.id },
        include: { 
          markets: true,
          tags: true,
        },
      });
    });

    return NextResponse.json({ event });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "An event with this slug already exists" }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating event:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
