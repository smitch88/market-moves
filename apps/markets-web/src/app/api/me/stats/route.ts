import { NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";
import { getUserStats } from "@/lib/services/stats-service";

export async function GET() {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const stats = await getUserStats(user.id);

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
