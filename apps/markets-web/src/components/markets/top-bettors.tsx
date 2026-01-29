"use client";

import { Avatar, AvatarFallback, AvatarImage, UserHoverCard } from "@vault/ui";
import type { Position, User } from "@vault/database";

interface TopBettorsProps {
  positions: (Position & {
    user: Pick<User, "id" | "handle" | "name" | "profileImageUrl" | "createdAt">;
  })[];
  outcomes: string[];
  pricingModel?: string; // 'CPMM' or 'PARI_MUTUEL'
}

export function TopBettors({ positions, outcomes, pricingModel }: TopBettorsProps) {
  const isCPMM = pricingModel === "CPMM";

  // Split positions by outcome - use shares for CPMM, amounts for pari-mutuel
  const outcome0Bettors = positions
    .filter((p) => isCPMM ? (p.shares0 || 0) > 0 : p.amount0 > 0)
    .sort((a, b) => isCPMM 
      ? ((b.shares0 || 0) - (a.shares0 || 0)) 
      : (b.amount0 - a.amount0)
    )
    .slice(0, 10);

  const outcome1Bettors = positions
    .filter((p) => isCPMM ? (p.shares1 || 0) > 0 : p.amount1 > 0)
    .sort((a, b) => isCPMM 
      ? ((b.shares1 || 0) - (a.shares1 || 0)) 
      : (b.amount1 - a.amount1)
    )
    .slice(0, 10);

  if (outcome0Bettors.length === 0 && outcome1Bettors.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No bettors yet</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Outcome 0 bettors */}
      <div>
        <h3 className="text-sm font-semibold text-chart-2 mb-4">
          {outcomes[0] || "Team A"} Holders
        </h3>
        <div className="space-y-3">
          {outcome0Bettors.map((position, index) => (
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
                  {isCPMM 
                    ? `${(position.shares0 || 0).toFixed(1)} shares`
                    : `$${position.amount0.toLocaleString()}`
                  }
                </p>
              </div>
            </UserHoverCard>
          ))}
        </div>
      </div>

      {/* Outcome 1 bettors */}
      <div>
        <h3 className="text-sm font-semibold text-chart-5 mb-4">
          {outcomes[1] || "Team B"} Holders
        </h3>
        <div className="space-y-3">
          {outcome1Bettors.map((position, index) => (
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
                  {isCPMM 
                    ? `${(position.shares1 || 0).toFixed(1)} shares`
                    : `$${position.amount1.toLocaleString()}`
                  }
                </p>
              </div>
            </UserHoverCard>
          ))}
        </div>
      </div>
    </div>
  );
}
