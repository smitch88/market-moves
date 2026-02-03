import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@vault/auth";
import { setUserCaptain, getUserCaptain } from "@/lib/services/kol-service";
import { z } from "zod";

const setCaptainSchema = z.object({
  captainId: z.string().nullable(), // null to remove captain
});

/**
 * GET /api/me/captain
 * Get the current user's captain (KOL they follow)
 */
export async function GET() {
  try {
    const user = await requireUser();
    const captain = await getUserCaptain(user.id);

    return NextResponse.json({ captain });
  } catch (error) {
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error fetching captain:", error);
    return NextResponse.json(
      { error: "Failed to fetch captain" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/me/captain
 * Set the current user's captain (KOL to follow)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { captainId } = setCaptainSchema.parse(body);

    // Enforce one-time captain selection:
    // - If a user already has a captain, they cannot remove or change it (idempotent set is allowed).
    const existingCaptain = await getUserCaptain(user.id);
    if (existingCaptain) {
      const isIdempotent = captainId === existingCaptain.id;
      if (!isIdempotent) {
        return NextResponse.json(
          { error: "Captain selection is a one-time choice and cannot be changed." },
          { status: 400 }
        );
      }
    }

    await setUserCaptain(user.id, captainId);

    // Return updated captain info
    const captain = captainId ? await getUserCaptain(user.id) : null;

    return NextResponse.json({
      success: true,
      captain,
      message: captainId
        ? "Successfully set captain"
        : "Captain removed",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "Not authenticated") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "Selected user is not a KOL") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Error setting captain:", error);
    return NextResponse.json(
      { error: "Failed to set captain" },
      { status: 500 }
    );
  }
}
