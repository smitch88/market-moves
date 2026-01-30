import { NextRequest, NextResponse } from "next/server";
import { prisma, AdminAction, Prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

const createSourceSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(["INTERNAL", "EXTERNAL", "HYBRID"]).default("INTERNAL"),
  externalApiUrl: z.string().url().optional().or(z.literal("")),
  externalApiHeaders: z.record(z.string()).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";
    const type = searchParams.get("type");

    const sources = await prisma.resolutionSource.findMany({
      where: {
        ...(!includeInactive && { isActive: true }),
        ...(type && { type: type as "INTERNAL" | "EXTERNAL" | "HYBRID" }),
      },
      include: {
        _count: {
          select: {
            markets: true,
            dataPoints: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ sources });
  } catch (error) {
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching resolution sources:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await request.json();
    const data = createSourceSchema.parse(body);

    const source = await prisma.$transaction(async (tx) => {
      const newSource = await tx.resolutionSource.create({
        data: {
          slug: data.slug,
          name: data.name,
          description: data.description || null,
          type: data.type as "INTERNAL" | "EXTERNAL" | "HYBRID",
          externalApiUrl: data.externalApiUrl || null,
          externalApiHeaders: data.externalApiHeaders 
            ? (data.externalApiHeaders as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          logoUrl: data.logoUrl || null,
          websiteUrl: data.websiteUrl || null,
          isActive: data.isActive,
          isPublic: data.isPublic,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminUserId: admin.id,
          action: AdminAction.RESOLUTION_SOURCE_CREATE,
          targetType: "ResolutionSource",
          targetId: newSource.id,
          metadata: {
            slug: data.slug,
            name: data.name,
            type: data.type,
          },
        },
      });

      return newSource;
    });

    return NextResponse.json({ source });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid request", details: error.errors }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ error: "A resolution source with this slug already exists" }, { status: 400 });
    }
    if (error instanceof Error && (error.message === "Unauthorized" || error.message.includes("Admin"))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating resolution source:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
