"use client";

import { ActivityRow, UserHoverCard } from "@vault/ui";
import type { Bet, User } from "@vault/database";

interface ActivityFeedProps {
  marketId: string;
  bets: (Bet & {
    user: Pick<User, "id" | "handle" | "name" | "profileImageUrl">;
    outcomeLabel?: string;
  })[];
  outcomes: string[];
}

export function ActivityFeed({ marketId, bets, outcomes }: ActivityFeedProps) {
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
      {bets.map((bet) => {
        // Get outcome label from the bet or parse from outcomes array
        const outcomeLabel = bet.outcomeLabel || outcomes[bet.outcomeIndex] || "Unknown";
        const isOutcome0 = bet.outcomeIndex === 0;

        return (
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
                  label: outcomeLabel,
                  color: isOutcome0
                    ? "bg-chart-2/20 text-chart-2"
                    : "bg-chart-5/20 text-chart-5",
                }}
                timestamp={bet.createdAt}
              />
            </div>
          </UserHoverCard>
        );
      })}
    </div>
  );
}
