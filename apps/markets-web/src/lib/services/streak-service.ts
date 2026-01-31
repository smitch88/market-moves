import { prisma } from "@vault/database";

// ============================================================================
// TYPES
// ============================================================================

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
  multiplier: number;
  nextMultiplier: number;
  daysUntilNextTier: number;
  badges: StreakBadgeInfo[];
}

export interface StreakBadgeInfo {
  badgeType: string;
  label: string;
  icon: "bronze" | "silver" | "gold" | "platinum" | "diamond";
  earnedAt: Date;
}

export interface StreakUpdateResult {
  streakUpdated: boolean;
  newStreak: number;
  previousStreak: number;
  multiplier: number;
  badgesAwarded: string[];
  isNewDay: boolean;
}

// ============================================================================
// BADGE DEFINITIONS
// ============================================================================

export const STREAK_BADGES = {
  streak_3: {
    threshold: 3,
    label: "3 Day Streak",
    icon: "bronze" as const,
  },
  streak_7: {
    threshold: 7,
    label: "7 Day Streak",
    icon: "silver" as const,
  },
  streak_14: {
    threshold: 14,
    label: "14 Day Streak",
    icon: "gold" as const,
  },
  streak_30: {
    threshold: 30,
    label: "30 Day Streak",
    icon: "platinum" as const,
  },
  streak_100: {
    threshold: 100,
    label: "100 Day Streak",
    icon: "diamond" as const,
  },
} as const;

// ============================================================================
// MULTIPLIER LOGIC
// ============================================================================

/**
 * Get the XP multiplier based on current streak
 * Day 1: 1.0x (no bonus)
 * Day 2: 1.1x
 * Day 3: 1.2x
 * Day 4: 1.3x
 * Day 5: 1.4x
 * Day 6: 1.5x
 * Day 7+: 3.0x
 */
export function getStreakMultiplier(streak: number): number {
  if (streak <= 1) return 1.0;
  if (streak === 2) return 1.1;
  if (streak === 3) return 1.2;
  if (streak === 4) return 1.3;
  if (streak === 5) return 1.4;
  if (streak === 6) return 1.5;
  return 3.0; // Day 7+
}

/**
 * Get the next tier multiplier and days until reaching it
 */
export function getNextTierInfo(streak: number): { nextMultiplier: number; daysUntilNextTier: number } {
  if (streak < 2) return { nextMultiplier: 1.1, daysUntilNextTier: 2 - streak };
  if (streak < 3) return { nextMultiplier: 1.2, daysUntilNextTier: 3 - streak };
  if (streak < 4) return { nextMultiplier: 1.3, daysUntilNextTier: 4 - streak };
  if (streak < 5) return { nextMultiplier: 1.4, daysUntilNextTier: 5 - streak };
  if (streak < 6) return { nextMultiplier: 1.5, daysUntilNextTier: 6 - streak };
  if (streak < 7) return { nextMultiplier: 3.0, daysUntilNextTier: 7 - streak };
  // Already at max tier
  return { nextMultiplier: 3.0, daysUntilNextTier: 0 };
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Get the start of today (midnight UTC)
 */
function getStartOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Get the start of yesterday (midnight UTC)
 */
function getStartOfYesterday(): Date {
  const today = getStartOfToday();
  return new Date(today.getTime() - 24 * 60 * 60 * 1000);
}

/**
 * Check if a date is the same day as today (UTC)
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getUTCFullYear() === date2.getUTCFullYear() &&
    date1.getUTCMonth() === date2.getUTCMonth() &&
    date1.getUTCDate() === date2.getUTCDate()
  );
}

/**
 * Check if a date is yesterday (UTC)
 */
function isYesterday(date: Date): boolean {
  const yesterday = getStartOfYesterday();
  return isSameDay(date, yesterday);
}

// ============================================================================
// STREAK SERVICE FUNCTIONS
// ============================================================================

/**
 * Update user's streak based on activity
 * Called after bet/sell/redeem actions
 */
export async function updateUserStreak(userId: string): Promise<StreakUpdateResult> {
  const today = getStartOfToday();

  // Get current user streak info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentStreak: true,
      longestStreak: true,
      lastActiveDate: true,
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const previousStreak = user.currentStreak;
  let newStreak = user.currentStreak;
  let isNewDay = false;
  const badgesAwarded: string[] = [];

  // Determine streak update based on last active date
  if (!user.lastActiveDate) {
    // First ever activity - start streak at 1
    newStreak = 1;
    isNewDay = true;
  } else if (isSameDay(user.lastActiveDate, today)) {
    // Already active today - no streak change
    isNewDay = false;
  } else if (isYesterday(user.lastActiveDate)) {
    // Active yesterday - continue streak
    newStreak = user.currentStreak + 1;
    isNewDay = true;
  } else {
    // Streak broken - reset to 1
    newStreak = 1;
    isNewDay = true;
  }

  // Only update if there's a change
  if (isNewDay) {
    const newLongestStreak = Math.max(user.longestStreak, newStreak);

    await prisma.user.update({
      where: { id: userId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastActiveDate: today,
      },
    });

    // Check and award badges
    const awarded = await checkAndAwardBadges(userId, newStreak);
    badgesAwarded.push(...awarded);
  }

  return {
    streakUpdated: isNewDay,
    newStreak,
    previousStreak,
    multiplier: getStreakMultiplier(newStreak),
    badgesAwarded,
    isNewDay,
  };
}

/**
 * Check if user should receive any new streak badges and award them
 */
export async function checkAndAwardBadges(userId: string, currentStreak: number): Promise<string[]> {
  const awardedBadges: string[] = [];

  // Get user's existing badges
  const existingBadges = await prisma.streakBadge.findMany({
    where: { userId },
    select: { badgeType: true },
  });

  const existingBadgeTypes = new Set(existingBadges.map((b) => b.badgeType));

  // Check each badge type
  for (const [badgeType, config] of Object.entries(STREAK_BADGES)) {
    // Award badge if streak meets threshold and badge not already earned
    if (currentStreak >= config.threshold && !existingBadgeTypes.has(badgeType)) {
      await prisma.streakBadge.create({
        data: {
          userId,
          badgeType,
        },
      });
      awardedBadges.push(badgeType);
    }
  }

  return awardedBadges;
}

/**
 * Get user's full streak information
 */
export async function getUserStreakInfo(userId: string): Promise<StreakInfo> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      currentStreak: true,
      longestStreak: true,
      lastActiveDate: true,
      streakBadges: {
        orderBy: { earnedAt: "asc" },
      },
    },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Check if streak has been broken (last active date is more than a day old)
  let effectiveStreak = user.currentStreak;
  if (user.lastActiveDate) {
    const today = getStartOfToday();
    const yesterday = getStartOfYesterday();
    
    if (!isSameDay(user.lastActiveDate, today) && !isSameDay(user.lastActiveDate, yesterday)) {
      // Streak is broken but not yet updated in DB
      effectiveStreak = 0;
    }
  }

  const multiplier = getStreakMultiplier(effectiveStreak);
  const { nextMultiplier, daysUntilNextTier } = getNextTierInfo(effectiveStreak);

  const badges: StreakBadgeInfo[] = user.streakBadges.map((badge) => {
    const config = STREAK_BADGES[badge.badgeType as keyof typeof STREAK_BADGES];
    return {
      badgeType: badge.badgeType,
      label: config?.label || badge.badgeType,
      icon: config?.icon || "bronze",
      earnedAt: badge.earnedAt,
    };
  });

  return {
    currentStreak: effectiveStreak,
    longestStreak: user.longestStreak,
    lastActiveDate: user.lastActiveDate,
    multiplier,
    nextMultiplier,
    daysUntilNextTier,
    badges,
  };
}

/**
 * Reset a user's streak (admin action)
 */
export async function resetUserStreak(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      currentStreak: 0,
      lastActiveDate: null,
    },
  });
}

/**
 * Get leaderboard of users by streak
 */
export async function getStreakLeaderboard(limit: number = 10) {
  const users = await prisma.user.findMany({
    where: {
      currentStreak: { gt: 0 },
    },
    select: {
      id: true,
      name: true,
      handle: true,
      profileImageUrl: true,
      currentStreak: true,
      longestStreak: true,
    },
    orderBy: { currentStreak: "desc" },
    take: limit,
  });

  return users.map((user, index) => ({
    rank: index + 1,
    ...user,
    multiplier: getStreakMultiplier(user.currentStreak),
  }));
}
