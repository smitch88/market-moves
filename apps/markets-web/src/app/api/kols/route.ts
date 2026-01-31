import { NextResponse } from "next/server";
import { getAllKOLs } from "@/lib/services/kol-service";

/**
 * GET /api/kols
 * Get all KOLs (Key Opinion Leaders) available to follow
 * This is a public endpoint
 */
export async function GET() {
  try {
    const kols = await getAllKOLs();

    return NextResponse.json({ kols });
  } catch (error) {
    console.error("Error fetching KOLs:", error);
    return NextResponse.json(
      { error: "Failed to fetch KOLs" },
      { status: 500 }
    );
  }
}
