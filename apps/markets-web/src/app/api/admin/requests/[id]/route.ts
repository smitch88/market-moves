import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@vault/database";
import { requireAdmin } from "@vault/auth";
import { z } from "zod";

// Validation schema for updating a market request
const updateRequestSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CREATED"]),
  adminNotes: z.string().max(2000).optional().nullable(),
});

/**
 * GET /api/admin/requests/[id]
 * 
 * Get a single market request by ID (admin only).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await params;

    const marketRequest = await prisma.marketRequest.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        sourceUrl: true,
        status: true,
        adminNotes: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            handle: true,
            email: true,
            profileImageUrl: true,
            createdAt: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
      },
    });

    if (!marketRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json(marketRequest);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching market request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/requests/[id]
 * 
 * Update a market request status (admin only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;

    const body = await request.json();
    const validation = updateRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }

    const { status, adminNotes } = validation.data;

    // Check if request exists
    const existingRequest = await prisma.marketRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Update the request
    const updatedRequest = await prisma.marketRequest.update({
      where: { id },
      data: {
        status,
        adminNotes: adminNotes ?? existingRequest.adminNotes,
        reviewedAt: status !== "PENDING" ? new Date() : null,
        reviewedBy: status !== "PENDING" ? admin.id : null,
      },
      select: {
        id: true,
        title: true,
        description: true,
        sourceUrl: true,
        status: true,
        adminNotes: true,
        reviewedAt: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            name: true,
            handle: true,
          },
        },
      },
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Unauthorized" || error.message.includes("Admin"))
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error updating market request:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
