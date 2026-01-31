import { prisma } from "@vault/database";

// ============================================================================
// TYPES
// ============================================================================

export interface KOLUser {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
  isKOL: boolean;
  kolApprovedAt: Date | null;
  followerCount: number;
}

export interface KOLBetNotificationData {
  id: string;
  kolUser: {
    id: string;
    name: string | null;
    handle: string | null;
    profileImageUrl: string | null;
  };
  market: {
    id: string;
    question: string;
  };
  event: {
    id: string;
    title: string;
    slug: string;
  };
  amount: number;
  outcomeIndex: number;
  outcomeLabel: string;
  createdAt: Date;
}

// ============================================================================
// KOL MANAGEMENT
// ============================================================================

/**
 * Grant KOL status to a user
 */
export async function grantKOLStatus(
  userId: string,
  adminUserId: string
): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isKOL: true,
      kolApprovedAt: new Date(),
      kolApprovedBy: adminUserId,
    },
  });
}

/**
 * Revoke KOL status from a user
 */
export async function revokeKOLStatus(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      isKOL: false,
      kolApprovedAt: null,
      kolApprovedBy: null,
    },
  });
}

/**
 * Get all KOLs
 */
export async function getAllKOLs(): Promise<KOLUser[]> {
  const kols = await prisma.user.findMany({
    where: { isKOL: true },
    select: {
      id: true,
      name: true,
      handle: true,
      profileImageUrl: true,
      isKOL: true,
      kolApprovedAt: true,
      _count: {
        select: {
          followers: true,
        },
      },
    },
    orderBy: { kolApprovedAt: "desc" },
  });

  return kols.map((kol) => ({
    id: kol.id,
    name: kol.name,
    handle: kol.handle,
    profileImageUrl: kol.profileImageUrl,
    isKOL: kol.isKOL,
    kolApprovedAt: kol.kolApprovedAt,
    followerCount: kol._count.followers,
  }));
}

/**
 * Check if a user is a KOL
 */
export async function isUserKOL(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isKOL: true },
  });
  return user?.isKOL ?? false;
}

// ============================================================================
// KOL BET NOTIFICATIONS
// ============================================================================

/**
 * Create a KOL bet notification record
 */
export async function createKOLBetNotification(
  kolUserId: string,
  betId: string,
  marketId: string,
  eventId: string,
  amount: number,
  outcomeIndex: number,
  outcomeLabel: string
): Promise<KOLBetNotificationData> {
  // Set expiry to 24 hours from now
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const notification = await prisma.kOLBetNotification.create({
    data: {
      kolUserId,
      betId,
      marketId,
      eventId,
      amount,
      outcomeIndex,
      outcomeLabel,
      expiresAt,
    },
    include: {
      kolUser: {
        select: {
          id: true,
          name: true,
          handle: true,
          profileImageUrl: true,
        },
      },
      market: {
        select: {
          id: true,
          question: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
  });

  return {
    id: notification.id,
    kolUser: notification.kolUser,
    market: notification.market,
    event: notification.event,
    amount: Number(notification.amount),
    outcomeIndex: notification.outcomeIndex,
    outcomeLabel: notification.outcomeLabel,
    createdAt: notification.createdAt,
  };
}

/**
 * Get recent KOL bet notifications
 */
export async function getRecentKOLBetNotifications(
  limit: number = 10,
  eventId?: string
): Promise<KOLBetNotificationData[]> {
  const where: { expiresAt: { gt: Date }; eventId?: string } = {
    expiresAt: { gt: new Date() },
  };

  if (eventId) {
    where.eventId = eventId;
  }

  const notifications = await prisma.kOLBetNotification.findMany({
    where,
    include: {
      kolUser: {
        select: {
          id: true,
          name: true,
          handle: true,
          profileImageUrl: true,
        },
      },
      market: {
        select: {
          id: true,
          question: true,
        },
      },
      event: {
        select: {
          id: true,
          title: true,
          slug: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return notifications.map((n) => ({
    id: n.id,
    kolUser: n.kolUser,
    market: n.market,
    event: n.event,
    amount: Number(n.amount),
    outcomeIndex: n.outcomeIndex,
    outcomeLabel: n.outcomeLabel,
    createdAt: n.createdAt,
  }));
}

/**
 * Clean up expired KOL bet notifications
 */
export async function cleanupExpiredNotifications(): Promise<number> {
  const result = await prisma.kOLBetNotification.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

// ============================================================================
// CAPTAIN/FOLLOWER SYSTEM
// ============================================================================

/**
 * Set a user's captain (KOL they follow)
 */
export async function setUserCaptain(
  userId: string,
  captainId: string | null
): Promise<void> {
  // If setting a captain, verify they are a KOL
  if (captainId) {
    const captain = await prisma.user.findUnique({
      where: { id: captainId },
      select: { isKOL: true },
    });

    if (!captain?.isKOL) {
      throw new Error("Selected user is not a KOL");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { captainId },
  });
}

/**
 * Get a user's captain
 */
export async function getUserCaptain(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      captain: {
        select: {
          id: true,
          name: true,
          handle: true,
          profileImageUrl: true,
          isKOL: true,
        },
      },
    },
  });

  return user?.captain ?? null;
}

/**
 * Get a KOL's followers
 */
export async function getKOLFollowers(
  kolUserId: string,
  page: number = 1,
  pageSize: number = 20
) {
  const [followers, total] = await Promise.all([
    prisma.user.findMany({
      where: { captainId: kolUserId },
      select: {
        id: true,
        name: true,
        handle: true,
        profileImageUrl: true,
        totalVolume: true,
        realizedPnL: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { totalVolume: "desc" },
    }),
    prisma.user.count({ where: { captainId: kolUserId } }),
  ]);

  return {
    followers: followers.map((f) => ({
      ...f,
      totalVolume: Number(f.totalVolume),
      realizedPnL: Number(f.realizedPnL),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Get KOL follower stats
 */
export async function getKOLFollowerStats(kolUserId: string) {
  const stats = await prisma.user.aggregate({
    where: { captainId: kolUserId },
    _count: true,
    _sum: {
      totalVolume: true,
      realizedPnL: true,
    },
  });

  return {
    followerCount: stats._count,
    totalFollowerVolume: Number(stats._sum.totalVolume) || 0,
    totalFollowerPnL: Number(stats._sum.realizedPnL) || 0,
  };
}

// ============================================================================
// EVENT-SPECIFIC KOL STATS
// ============================================================================

/**
 * Get top KOLs betting on a specific event
 */
export async function getTopKOLsForEvent(
  eventId: string,
  limit: number = 5
) {
  // Get all bets by KOLs on this event's markets
  const kolBets = await prisma.bet.groupBy({
    by: ["userId"],
    where: {
      market: { eventId },
      status: "CONFIRMED",
      user: { isKOL: true },
    },
    _sum: { amount: true },
    _count: true,
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  if (kolBets.length === 0) {
    return [];
  }

  // Get user details and latest bet for each KOL
  const kolUserIds = kolBets.map((b) => b.userId);
  const kolUsers = await prisma.user.findMany({
    where: { id: { in: kolUserIds } },
    select: {
      id: true,
      name: true,
      handle: true,
      profileImageUrl: true,
    },
  });

  // Get latest bet for each KOL on this event
  const latestBets = await Promise.all(
    kolUserIds.map(async (userId) => {
      const bet = await prisma.bet.findFirst({
        where: {
          userId,
          market: { eventId },
          status: "CONFIRMED",
        },
        include: {
          market: {
            select: {
              question: true,
              outcomes: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      return { userId, bet };
    })
  );

  const userMap = new Map(kolUsers.map((u) => [u.id, u]));
  const latestBetMap = new Map(latestBets.map((lb) => [lb.userId, lb.bet]));

  return kolBets.map((kb) => {
    const user = userMap.get(kb.userId);
    const latestBet = latestBetMap.get(kb.userId);
    const outcomes = latestBet?.market?.outcomes
      ? JSON.parse(latestBet.market.outcomes)
      : ["Yes", "No"];

    return {
      user: user || { id: kb.userId, name: null, handle: null, profileImageUrl: null },
      totalVolume: Number(kb._sum.amount) || 0,
      betCount: kb._count,
      latestBet: latestBet
        ? {
            marketQuestion: latestBet.market.question,
            outcomeLabel: outcomes[latestBet.outcomeIndex] || `Outcome ${latestBet.outcomeIndex}`,
            amount: Number(latestBet.amount),
            createdAt: latestBet.createdAt,
          }
        : null,
    };
  });
}
