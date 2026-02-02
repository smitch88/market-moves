import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@vault/auth";
import { FeatureFlagStatus } from "@vault/database";
import {
  getAllFeatureFlags,
  createFeatureFlag,
} from "@/lib/services/feature-flag-service";
import { z } from "zod";

const createFlagSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, "Key must be lowercase with underscores only"),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  status: z.nativeEnum(FeatureFlagStatus).optional(),
});

/**
 * GET /api/admin/feature-flags
 * Get all feature flags
 */
export async function GET() {
  try {
    await requireAdmin();
    
    const flags = await getAllFeatureFlags();
    
    return NextResponse.json({ flags });
  } catch (error) {
    console.error("Error fetching feature flags:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch feature flags" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/feature-flags
 * Create a new feature flag
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const body = await request.json();
    const validation = createFlagSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.error.errors },
        { status: 400 }
      );
    }
    
    const flag = await createFeatureFlag(validation.data);
    
    return NextResponse.json({ flag }, { status: 201 });
  } catch (error) {
    console.error("Error creating feature flag:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    // Check for unique constraint violation
    if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
      return NextResponse.json(
        { error: "A feature flag with this key already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create feature flag" },
      { status: 500 }
    );
  }
}

