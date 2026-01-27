"use client";

import { ActivityRow, UserHoverCard } from "@vault/ui";
import type { Bet, User, Outcome } from "@vault/database";

interface ActivityFeedProps {
  marketId: string;
  bets: (Bet & {
    user: Pick<User, "id" | "handle" | "name" | "profileImageUrl">;
    outcome: Outcome;
  })[];
}

export function ActivityFeed({ marketId, bets }: ActivityFeedProps) {
  if (bets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No activity yet</p>
        <p className="text-sm">Be the first to place a bet!</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {bets.map((bet) => (
        <UserHoverCard
          key={bet.id}
          user={{
            handle: bet.user.handle,
            name: bet.user.name,
            profileImageUrl: bet.user.profileImageUrl,
          }}
        >
          <div>
            <ActivityRow
              user={{
                handle: bet.user.handle,
                name: bet.user.name,
                profileImageUrl: bet.user.profileImageUrl,
              }}
              action="bet"
              amount={bet.amount}
              outcome={{
                label: bet.outcome.label,
                color:
                  bet.outcome.key === "A"
                    ? "bg-chart-2/20 text-chart-2"
                    : "bg-chart-5/20 text-chart-5",
              }}
              timestamp={bet.createdAt}
            />
          </div>
        </UserHoverCard>
      ))}
    </div>
  );
}
