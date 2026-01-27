"use client";

import { Avatar, AvatarFallback, AvatarImage, UserHoverCard } from "@vault/ui";
import type { Position, User, Outcome } from "@vault/database";

interface TopBettorsProps {
  positions: (Position & {
    user: Pick<User, "id" | "handle" | "name" | "profileImageUrl" | "createdAt">;
  })[];
  outcomeA?: Outcome;
  outcomeB?: Outcome;
}

export function TopBettors({ positions, outcomeA, outcomeB }: TopBettorsProps) {
  // Split positions by outcome
  const outcomeABettors = positions
    .filter((p) => p.amountOutcomeA > 0)
    .sort((a, b) => b.amountOutcomeA - a.amountOutcomeA)
    .slice(0, 10);

  const outcomeBBettors = positions
    .filter((p) => p.amountOutcomeB > 0)
    .sort((a, b) => b.amountOutcomeB - a.amountOutcomeB)
    .slice(0, 10);

  if (outcomeABettors.length === 0 && outcomeBBettors.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No bettors yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Outcome A bettors */}
      <div>
        <h3 className="text-sm font-semibold text-chart-2 mb-4">
          {outcomeA?.label || "Team A"} Holders
        </h3>
        <div className="space-y-3">
          {outcomeABettors.map((position, index) => (
            <UserHoverCard
              key={position.id}
              user={{
                handle: position.user.handle,
                name: position.user.name,
                profileImageUrl: position.user.profileImageUrl,
                createdAt: position.user.createdAt,
              }}
            >
              <div className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    {position.user.profileImageUrl && (
                      <AvatarImage src={position.user.profileImageUrl} />
                    )}
                    <AvatarFallback className="text-xs">
                      {(position.user.name || position.user.handle || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {index < 3 && (
                    <span
                      className={`absolute -top-1 -left-1 h-4 w-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        index === 0
                          ? "bg-yellow-500 text-yellow-950"
                          : index === 1
                          ? "bg-gray-300 text-gray-800"
                          : "bg-amber-600 text-amber-950"
                      }`}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {position.user.name || position.user.handle || "Anonymous"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-chart-2">
                  ${position.amountOutcomeA.toLocaleString()}
                </p>
              </div>
            </UserHoverCard>
          ))}
        </div>
      </div>

      {/* Outcome B bettors */}
      <div>
        <h3 className="text-sm font-semibold text-chart-5 mb-4">
          {outcomeB?.label || "Team B"} Holders
        </h3>
        <div className="space-y-3">
          {outcomeBBettors.map((position, index) => (
            <UserHoverCard
              key={position.id}
              user={{
                handle: position.user.handle,
                name: position.user.name,
                profileImageUrl: position.user.profileImageUrl,
                createdAt: position.user.createdAt,
              }}
            >
              <div className="flex items-center gap-3 cursor-pointer hover:bg-muted/50 rounded-lg p-2 -m-2 transition-colors">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    {position.user.profileImageUrl && (
                      <AvatarImage src={position.user.profileImageUrl} />
                    )}
                    <AvatarFallback className="text-xs">
                      {(position.user.name || position.user.handle || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {index < 3 && (
                    <span
                      className={`absolute -top-1 -left-1 h-4 w-4 rounded-full text-[10px] font-bold flex items-center justify-center ${
                        index === 0
                          ? "bg-yellow-500 text-yellow-950"
                          : index === 1
                          ? "bg-gray-300 text-gray-800"
                          : "bg-amber-600 text-amber-950"
                      }`}
                    >
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {position.user.name || position.user.handle || "Anonymous"}
                  </p>
                </div>
                <p className="text-sm font-semibold text-chart-5">
                  ${position.amountOutcomeB.toLocaleString()}
                </p>
              </div>
            </UserHoverCard>
          ))}
        </div>
      </div>
    </div>
  );
}
