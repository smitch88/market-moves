"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ActivityRow, UserHoverCard } from "@vault/ui";
import { Loader2, CheckCircle, XCircle, DollarSign, Users, BarChart3 } from "lucide-react";
import Link from "next/link";
import { getMarketUrl, getAdminMarketUrl } from "@/lib/urls";

interface Activity {
  type: "bet" | "market_action" | "user_signup";
  timestamp: string;
  data: Record<string, unknown>;
}

// Helper to parse outcomes
function parseOutcomes(outcomes: string | undefined): string[] {
  if (!outcomes) return ["Yes", "No"];
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

interface RecentActivityProps {
  limit?: number;
}

export function RecentActivity({ limit = 5 }: RecentActivityProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["adminActivity", limit],
    queryFn: async () => {
      const res = await fetch(`/api/admin/activity?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to fetch activity");
      return res.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const activities: Activity[] = data?.activities || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((activity, index) => {
        if (activity.type === "bet") {
          const bet = activity.data as {
            id: string;
            amount: number;
            outcomeIndex: number;
            outcomeLabel?: string;
            createdAt: string;
            user: { handle?: string; name?: string; profileImageUrl?: string };
            market: { 
              slug?: string; 
              question?: string; 
              outcomes?: string;
              event?: { slug: string };
            };
          };
          
          const outcomes = parseOutcomes(bet.market?.outcomes);
          const outcomeLabel = bet.outcomeLabel || outcomes[bet.outcomeIndex] || "Unknown";
          const eventSlug = bet.market?.event?.slug || bet.market?.slug;
          
          return (
            <UserHoverCard
              key={`bet-${bet.id}`}
              user={{
                handle: bet.user.handle,
                name: bet.user.name,
                profileImageUrl: bet.user.profileImageUrl,
              }}
            >
              <Link
                href={getMarketUrl(eventSlug || "")}
                className="block py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors -mx-6 px-6"
              >
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
                    color:
                      bet.outcomeIndex === 0
                        ? "bg-chart-2/20 text-chart-2"
                        : "bg-chart-5/20 text-chart-5",
                  }}
                  timestamp={bet.createdAt}
                />
              </Link>
            </UserHoverCard>
          );
        }

        if (activity.type === "market_action") {
          const action = activity.data as {
            id: string;
            action: string;
            targetId: string;
            metadata?: { title?: string };
            admin: { name?: string; handle?: string };
            market?: { title?: string; slug?: string };
          };
          
          const actionLabels: Record<string, { label: string; icon: typeof BarChart3; color: string }> = {
            EVENT_CREATE: {
              label: "created event",
              icon: BarChart3,
              color: "text-blue-500",
            },
            EVENT_UPDATE: {
              label: "updated event",
              icon: BarChart3,
              color: "text-yellow-500",
            },
            MARKET_CREATE: {
              label: "created market",
              icon: BarChart3,
              color: "text-blue-500",
            },
            MARKET_UPDATE: {
              label: "updated market",
              icon: BarChart3,
              color: "text-yellow-500",
            },
            MARKET_CLOSE: {
              label: "closed market",
              icon: XCircle,
              color: "text-orange-500",
            },
            MARKET_RESOLVE: {
              label: "resolved market",
              icon: CheckCircle,
              color: "text-green-500",
            },
            MARKET_SETTLE: {
              label: "settled market",
              icon: DollarSign,
              color: "text-purple-500",
            },
          };

          const actionInfo = actionLabels[action.action] || {
            label: action.action.toLowerCase().replace("_", " "),
            icon: BarChart3,
            color: "text-muted-foreground",
          };

          const market = action.market;
          const marketTitle = market?.title || action.metadata?.title || `Market ${action.targetId}`;

          const content = (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className={`p-2 rounded-lg bg-muted ${actionInfo.color}`}>
                <actionInfo.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">
                  <span className="font-medium">
                    {action.admin.name || action.admin.handle || "Admin"}
                  </span>
                  <span className="text-muted-foreground ml-1">{actionInfo.label}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">{marketTitle}</p>
              </div>
            </div>
          );

          return (
            <div
              key={`action-${action.id}`}
              className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors -mx-6 px-6"
            >
              <Link href={getAdminMarketUrl(action.targetId)} className="flex-1">
                {content}
              </Link>
              <div className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
              </div>
            </div>
          );
        }

        if (activity.type === "user_signup") {
          const user = activity.data as {
            id: string;
            handle?: string;
            name?: string;
            profileImageUrl?: string;
          };
          
          return (
            <UserHoverCard
              key={`user-${user.id}`}
              user={{
                handle: user.handle,
                name: user.name,
                profileImageUrl: user.profileImageUrl,
              }}
            >
              <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors -mx-6 px-6">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="p-2 rounded-lg bg-muted text-green-500">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">
                        {user.name || user.handle || "Anonymous"}
                      </span>
                      <span className="text-muted-foreground ml-1">joined</span>
                    </p>
                    {user.handle && (
                      <p className="text-xs text-muted-foreground">@{user.handle}</p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                </div>
              </div>
            </UserHoverCard>
          );
        }

        return null;
      })}
    </div>
  );
}
