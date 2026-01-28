"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ExternalLink, Clock, Users, ChevronRight, TrendingUp } from "lucide-react";
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
import { cn } from "@vault/ui/lib/utils";
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

function parseOutcomePrices(outcomePrices: string): string[] {
  try {
    return JSON.parse(outcomePrices);
  } catch {
    return ["0.50", "0.50"];
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

// Market row component for the market list
function MarketRow({ 
  market, 
  isSelected, 
  onClick 
}: { 
  market: Market; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const percent0 = Math.round(parseFloat(outcomePrices[0] || "0.50") * 100);
  const percent1 = Math.round(parseFloat(outcomePrices[1] || "0.50") * 100);

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-lg border transition-all",
        isSelected 
          ? "bg-primary/10 border-primary/30" 
          : "bg-muted/30 border-transparent hover:bg-muted/50 hover:border-border"
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{market.question}</h3>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs font-medium text-outcome-yes">{outcomes[0]}: {percent0}%</span>
            <span className="text-muted-foreground">•</span>
            <span className="text-xs font-medium text-outcome-no">{outcomes[1]}: {percent1}%</span>
          </div>
        </div>
        <ChevronRight className={cn(
          "h-4 w-4 transition-transform",
          isSelected ? "text-primary rotate-90" : "text-muted-foreground"
        )} />
      </div>
    </button>
  );
}

export function MarketDetail({ event }: MarketDetailProps) {
  const [selectedMarketId, setSelectedMarketId] = useState<string>(event.markets[0]?.id || "");

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

  // Get the selected market (or first if none selected)
  const selectedMarket = event.markets.find(m => m.id === selectedMarketId) || event.markets[0];
  
  if (!selectedMarket) {
    return <div>No markets found for this event</div>;
  }

  const outcomes = parseOutcomes(selectedMarket.outcomes);
  const outcomeColors = parseOutcomeColors(selectedMarket.outcomeColors);
  const outcomePrices = parseOutcomePrices(selectedMarket.outcomePrices);
  
  // Calculate stats from prices or use fetched data
  const stats = data?.stats || { percent0: 50, percent1: 50, percentA: 50, percentB: 50, totalBets: 0, totalPool: 0 };
  const percent0 = Math.round(parseFloat(outcomePrices[0] || "0.50") * 100);
  const percent1 = Math.round(parseFloat(outcomePrices[1] || "0.50") * 100);

  // Calculate total volume for event
  const totalVolume = event.markets.reduce((sum, m) => {
    return sum + (m.seed0 || 0) + (m.seed1 || 0) + (m.pool0 || 0) + (m.pool1 || 0);
  }, 0);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Back navigation */}
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Events</span>
      </Link>

      {/* Event Header */}
      <GlassCard className="mb-6">
        {/* Banner */}
        {event.bannerUrl && (
          <div className="relative h-48 w-full">
            <Image
              src={event.bannerUrl}
              alt={event.title}
              fill
              className="object-cover rounded-t-lg"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />
          </div>
        )}

        <GlassCardHeader className={event.bannerUrl ? "-mt-16 relative z-10" : ""}>
          <div className="flex items-start gap-4">
            {event.logoUrl && (
              <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted border-2 border-background shadow-lg shrink-0">
                <Image
                  src={event.logoUrl}
                  alt=""
                  width={80}
                  height={80}
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary">{event.category}</Badge>
                {event.tags?.map(tag => (
                  <Badge key={tag.id} variant="outline">{tag.label}</Badge>
                ))}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold">{event.title}</h1>
              {event.description && (
                <p className="text-muted-foreground mt-2 line-clamp-2">{event.description}</p>
              )}
            </div>
          </div>
        </GlassCardHeader>

        <GlassCardContent>
          {/* Event stats row */}
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" />
              <span className="font-medium text-foreground">
                ${totalVolume.toLocaleString()}
              </span>
              <span>total volume</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-foreground">{event.markets.length}</span>
              <span>markets</span>
            </div>
            {event.endTime && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Ends {format(new Date(event.endTime), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content - Markets List */}
        <div className="lg:col-span-2 space-y-6">
          {/* Markets list */}
          <GlassCard>
            <GlassCardHeader>
              <h2 className="text-lg font-semibold">Markets ({event.markets.length})</h2>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="space-y-2">
                {event.markets.map((market) => (
                  <MarketRow
                    key={market.id}
                    market={market}
                    isSelected={market.id === selectedMarketId}
                    onClick={() => setSelectedMarketId(market.id)}
                  />
                ))}
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Selected Market Details */}
          <GlassCard>
            <GlassCardHeader>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">{selectedMarket.question}</h2>
                <Badge
                  variant={
                    selectedMarket.status === "OPEN"
                      ? "success"
                      : selectedMarket.status === "CLOSED"
                      ? "warning"
                      : "secondary"
                  }
                >
                  {selectedMarket.status}
                </Badge>
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
                  <span>{stats.totalBets || 0} bets</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">
                    ${((selectedMarket.pool0 || 0) + (selectedMarket.pool1 || 0) + (selectedMarket.seed0 || 0) + (selectedMarket.seed1 || 0)).toLocaleString()}
                  </span>
                  <span>pool</span>
                </div>
                {selectedMarket.closesAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Closes {format(new Date(selectedMarket.closesAt), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Rules / Details */}
          {selectedMarket.detailsMarkdown && (
            <GlassCard>
              <GlassCardHeader>
                <h2 className="text-lg font-semibold">Rules</h2>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{selectedMarket.detailsMarkdown}</ReactMarkdown>
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
                    marketId={selectedMarket.id} 
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
            market={selectedMarket} 
            event={event}
            stats={stats} 
          />

          {/* Timeline */}
          <GlassCard>
            <GlassCardContent className="pt-6">
              <MarketTimeline
                currentStatus={selectedMarket.status as MarketStatus}
                publishedAt={selectedMarket.publishedAt}
                opensAt={selectedMarket.opensAt}
                closesAt={selectedMarket.closesAt}
                resolvedAt={selectedMarket.resolvedAt}
                settledAt={selectedMarket.settledAt}
              />
            </GlassCardContent>
          </GlassCard>

          {/* Resolution source */}
          {selectedMarket.resolutionSourceUrl && (
            <GlassCard>
              <GlassCardHeader>
                <h3 className="text-sm font-semibold">Resolution Source</h3>
              </GlassCardHeader>
              <GlassCardContent>
                <a
                  href={selectedMarket.resolutionSourceUrl}
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
