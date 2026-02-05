import { NextRequest, NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { prisma } from "@vault/database";
import { z } from "zod";

// Validation schema for creating a market request
const createMarketRequestSchema = z.object({
  title: z
    .string()
    .min(5, "Title must be at least 5 characters")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(2000, "Description must be at most 2000 characters"),
  sourceUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .nullable()
    .or(z.literal("")),
});

/**
 * POST /api/market-requests
 * 
 * Create a new market request.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = createMarketRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { title, description, sourceUrl } = validation.data;

    // Create the market request
    const marketRequest = await prisma.marketRequest.create({
      data: {
        userId: user.id,
        title,
        description,
        sourceUrl: sourceUrl || null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        sourceUrl: true,
        status: true,
        createdAt: true,
      },
    });

    return NextResponse.json(marketRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating market request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
