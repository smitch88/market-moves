import { NextResponse } from "next/server";
import { getEffectiveUser } from "@/lib/auth/get-effective-user";

// XP required for a given level: level^2 * 1000
function xpForLevel(level: number): number {
  return level * level * 1000;
}

function calculateLevel(xp: number): number {
  return Math.floor(Math.sqrt(xp / 1000));
}

function calculateProgress(xp: number): {
  level: number;
  currentLevelXp: number;
  nextLevelXp: number;
  xpInCurrentLevel: number;
  xpNeededForNext: number;
  progress: number;
} {
  const level = calculateLevel(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const xpInCurrentLevel = xp - currentLevelXp;
  const xpNeededForNext = nextLevelXp - currentLevelXp;
  const progress = xpNeededForNext > 0 ? xpInCurrentLevel / xpNeededForNext : 0;

  return {
    level,
    currentLevelXp,
    nextLevelXp,
    xpInCurrentLevel,
    xpNeededForNext,
    progress: Math.min(Math.max(progress, 0), 1), // Clamp between 0 and 1
  };
}

export async function GET() {
  try {
    const user = await getEffectiveUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Return a random XP value between 100 and 10000 for now
    // In the future, this would be calculated from user activity
    const xp = Math.floor(Math.random() * 9900) + 100;
    const progressData = calculateProgress(xp);

    return NextResponse.json({ 
      xp,
      ...progressData,
    });
  } catch (error) {
    console.error("Error fetching XP:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

