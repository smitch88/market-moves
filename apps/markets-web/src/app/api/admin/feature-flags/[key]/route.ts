import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import { FeatureFlagStatus } from "@vault/database";
import {
  getFeatureFlag,
  updateFeatureFlag,
  deleteFeatureFlag,
} from "@/lib/services/feature-flag-service";
import { z } from "zod";

const updateFlagSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional().nullable(),
  status: z.nativeEnum(FeatureFlagStatus).optional(),
});

/**
 * GET /api/admin/feature-flags/[key]
 * Get a single feature flag
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireAdmin();
    
    const { key } = await params;
    const flag = await getFeatureFlag(key);
    
    if (!flag) {
      return NextResponse.json(
        { error: "Feature flag not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ flag });
  } catch (error) {
    console.error("Error fetching feature flag:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch feature flag" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/feature-flags/[key]
 * Update a feature flag
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireAdmin();
    
    const { key } = await params;
    const body = await request.json();
    const validation = updateFlagSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const flag = await updateFeatureFlag(key, validation.data);
    
    return NextResponse.json({ flag });
  } catch (error) {
    console.error("Error updating feature flag:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    // Check for not found
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json(
        { error: "Feature flag not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update feature flag" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/feature-flags/[key]
 * Delete a feature flag
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    await requireAdmin();
    
    const { key } = await params;
    await deleteFeatureFlag(key);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting feature flag:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    // Check for not found
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2025') {
      return NextResponse.json(
        { error: "Feature flag not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete feature flag" },
      { status: 500 }
    );
  }
}

