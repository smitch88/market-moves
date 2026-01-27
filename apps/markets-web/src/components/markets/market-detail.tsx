"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ExternalLink, Clock, Users } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  MarketTimeline,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
} from "@vault/ui";
import type { Market, Event, MarketStatus } from "@vault/database";
import { BettingPanel } from "./betting-panel";
import { ActivityFeed } from "./activity-feed";
import { TopBettors } from "./top-bettors";

// Helper functions to parse JSON fields
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

function parseOutcomeColors(outcomeColors: string | null): string[] | null {
  if (!outcomeColors) return null;
  try {
    return JSON.parse(outcomeColors);
  } catch {
    return null;
  }
}

interface MarketDetailProps {
  event: Event & { 
    markets: Market[];
    tags?: { id: string; slug: string; label: string }[];
  };
}

async function fetchEventData(slug: string) {
  const res = await fetch(`/api/markets/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch event");
  return res.json();
}

export function MarketDetail({ event }: MarketDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["market", event.slug],
    queryFn: () => fetchEventData(event.slug),
    placeholderData: { 
      event, 
      stats: { percent0: 50, percent1: 50, percentA: 50, percentB: 50, totalBets: 0, totalPool: 0 } 
    },
    staleTime: 0,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    gcTime: 0,
  });

  // Get the first/primary market for display
  const primaryMarket = event.markets[0];
  if (!primaryMarket) {
    return <div>No markets found for this event</div>;
  }

  const outcomes = parseOutcomes(primaryMarket.outcomes);
  const outcomeColors = parseOutcomeColors(primaryMarket.outcomeColors);
  const stats = data?.stats || { percent0: 50, percent1: 50, percentA: 50, percentB: 50, totalBets: 0, totalPool: 0 };

  // Normalize stats (support both old percentA/B and new percent0/1)
  const percent0 = stats.percent0 ?? stats.percentA ?? 50;
  const percent1 = stats.percent1 ?? stats.percentB ?? 50;

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Markets</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Event header */}
          <GlassCard>
            {/* Banner */}
            {event.bannerUrl && (
              <div className="relative h-48 w-full">
                <Image
                  src={event.bannerUrl}
                  alt={event.title}
                  fill
                  className="object-cover rounded-t-lg"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              </div>
            )}

            <GlassCardHeader className={event.bannerUrl ? "-mt-12 relative z-10" : ""}>
              <div className="flex items-start gap-4">
                {event.logoUrl && (
                  <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted border border-border shrink-0">
                    <Image
                      src={event.logoUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{event.category}</Badge>
                    <Badge
                      variant={
                        primaryMarket.status === "OPEN"
                          ? "success"
                          : primaryMarket.status === "CLOSED"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {primaryMarket.status}
                    </Badge>
                  </div>
                  <h1 className="text-2xl font-bold">{primaryMarket.question}</h1>
                  {event.markets.length > 1 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {event.markets.length} markets in this event
                    </p>
                  )}
                </div>
              </div>
            </GlassCardHeader>

            <GlassCardContent>
              {/* Outcome percentages */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 text-center">
                  <p className="text-3xl font-bold text-outcome-yes">{percent0}%</p>
                  <p className="text-sm text-muted-foreground">{outcomes[0]}</p>
                </div>
                <div className="flex-1 h-2.5 bg-muted/30 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-outcome-yes/80 transition-all duration-500"
                    style={{ width: `${percent0}%` }}
                  />
                  <div
                    className="h-full bg-outcome-no/80 transition-all duration-500"
                    style={{ width: `${percent1}%` }}
                  />
                </div>
                <div className="flex-1 text-center">
                  <p className="text-3xl font-bold text-outcome-no">{percent1}%</p>
                  <p className="text-sm text-muted-foreground">{outcomes[1]}</p>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  <span>{stats.totalBets} bets</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">
                    ${stats.totalPool?.toLocaleString() || 0}
                  </span>
                  <span>pool</span>
                </div>
                {primaryMarket.closesAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Closes {format(new Date(primaryMarket.closesAt), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Rules / Details */}
          {primaryMarket.detailsMarkdown && (
            <GlassCard>
              <GlassCardHeader>
                <h2 className="text-lg font-semibold">Rules</h2>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{primaryMarket.detailsMarkdown}</ReactMarkdown>
                </div>
              </GlassCardContent>
            </GlassCard>
          )}

          {/* Activity tabs */}
          <Tabs defaultValue="activity" className="w-full">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="top-bettors">Top Bettors</TabsTrigger>
            </TabsList>
            <TabsContent value="activity">
              <GlassCard>
                <GlassCardContent className="pt-6">
                  <ActivityFeed 
                    marketId={primaryMarket.id} 
                    bets={data?.market?.bets || data?.event?.markets?.[0]?.bets || []}
                    outcomes={outcomes}
                  />
                </GlassCardContent>
              </GlassCard>
            </TabsContent>
            <TabsContent value="top-bettors">
              <GlassCard>
                <GlassCardContent className="pt-6">
                  <TopBettors
                    positions={data?.market?.positions || data?.event?.markets?.[0]?.positions || []}
                    outcomes={outcomes}
                  />
                </GlassCardContent>
              </GlassCard>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Betting panel */}
          <BettingPanel 
            market={primaryMarket} 
            event={event}
            stats={stats} 
          />

          {/* Timeline */}
          <GlassCard>
            <GlassCardContent className="pt-6">
              <MarketTimeline
                currentStatus={primaryMarket.status as MarketStatus}
                publishedAt={primaryMarket.publishedAt}
                opensAt={primaryMarket.opensAt}
                closesAt={primaryMarket.closesAt}
                resolvedAt={primaryMarket.resolvedAt}
                settledAt={primaryMarket.settledAt}
              />
            </GlassCardContent>
          </GlassCard>

          {/* Resolution source */}
          {primaryMarket.resolutionSourceUrl && (
            <GlassCard>
              <GlassCardHeader>
                <h3 className="text-sm font-semibold">Resolution Source</h3>
              </GlassCardHeader>
              <GlassCardContent>
                <a
                  href={primaryMarket.resolutionSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary hover:underline text-sm"
                >
                  <ExternalLink className="h-4 w-4" />
                  View source
                </a>
              </GlassCardContent>
            </GlassCard>
          )}
        </div>
      </div>
    </div>
  );
}
