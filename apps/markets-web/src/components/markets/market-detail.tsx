"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import ReactMarkdown from "react-markdown";
import { ArrowLeft, ExternalLink, Clock, Users } from "lucide-react";
import {
  Button,
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
import type { Market, Outcome, MarketStatus } from "@vault/database";
import { BettingPanel } from "./betting-panel";
import { ActivityFeed } from "./activity-feed";
import { TopBettors } from "./top-bettors";

interface MarketDetailProps {
  market: Market & { outcomes: Outcome[] };
}

async function fetchMarketData(slug: string) {
  const res = await fetch(`/api/markets/${slug}`);
  if (!res.ok) throw new Error("Failed to fetch market");
  return res.json();
}

export function MarketDetail({ market }: MarketDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["market", market.slug],
    queryFn: () => fetchMarketData(market.slug),
    placeholderData: { market, stats: { percentA: 50, percentB: 50, totalBets: 0, totalPool: 0 } },
    staleTime: 0, // Always consider data stale
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    gcTime: 0, // Don't cache
  });

  const outcomeA = market.outcomes.find((o) => o.key === "A");
  const outcomeB = market.outcomes.find((o) => o.key === "B");
  const stats = data?.stats || { percentA: 50, percentB: 50, totalBets: 0, totalPool: 0 };

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
          {/* Market header */}
          <GlassCard>
            {/* Banner */}
            {market.bannerUrl && (
              <div className="relative h-48 w-full">
                <Image
                  src={market.bannerUrl}
                  alt={market.title}
                  fill
                  className="object-cover rounded-t-lg"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
              </div>
            )}

            <GlassCardHeader className={market.bannerUrl ? "-mt-12 relative z-10" : ""}>
              <div className="flex items-start gap-4">
                {market.logoUrl && (
                  <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted border border-border shrink-0">
                    <Image
                      src={market.logoUrl}
                      alt=""
                      width={64}
                      height={64}
                      className="object-cover"
                    />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="secondary">{market.category}</Badge>
                    <Badge
                      variant={
                        market.status === "OPEN"
                          ? "success"
                          : market.status === "CLOSED"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {market.status}
                    </Badge>
                  </div>
                  <h1 className="text-2xl font-bold">{market.question || market.title}</h1>
                </div>
              </div>
            </GlassCardHeader>

            <GlassCardContent>
              {/* Outcome percentages */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 text-center">
                  <p className="text-3xl font-bold text-outcome-yes">{stats.percentA}%</p>
                  <p className="text-sm text-muted-foreground">{outcomeA?.label}</p>
                </div>
                <div className="flex-1 h-2.5 bg-muted/30 rounded-full overflow-hidden flex">
                  <div
                    className="h-full bg-outcome-yes/80 transition-all duration-500"
                    style={{ width: `${stats.percentA}%` }}
                  />
                  <div
                    className="h-full bg-outcome-no/80 transition-all duration-500"
                    style={{ width: `${stats.percentB}%` }}
                  />
                </div>
                <div className="flex-1 text-center">
                  <p className="text-3xl font-bold text-outcome-no">{stats.percentB}%</p>
                  <p className="text-sm text-muted-foreground">{outcomeB?.label}</p>
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
                {market.closesAt && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>Closes {format(new Date(market.closesAt), "MMM d, yyyy")}</span>
                  </div>
                )}
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Rules / Details */}
          {market.detailsMarkdown && (
            <GlassCard>
              <GlassCardHeader>
                <h2 className="text-lg font-semibold">Rules</h2>
              </GlassCardHeader>
              <GlassCardContent>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown>{market.detailsMarkdown}</ReactMarkdown>
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
                  <ActivityFeed marketId={market.id} bets={data?.market?.bets || []} />
                </GlassCardContent>
              </GlassCard>
            </TabsContent>
            <TabsContent value="top-bettors">
              <GlassCard>
                <GlassCardContent className="pt-6">
                  <TopBettors
                    positions={data?.market?.positions || []}
                    outcomeA={outcomeA}
                    outcomeB={outcomeB}
                  />
                </GlassCardContent>
              </GlassCard>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Betting panel */}
          <BettingPanel market={market} stats={stats} />

          {/* Timeline */}
          <GlassCard>
            <GlassCardContent className="pt-6">
              <MarketTimeline
                currentStatus={market.status as MarketStatus}
                publishedAt={market.publishedAt}
                opensAt={market.opensAt}
                closesAt={market.closesAt}
                resolvedAt={market.resolvedAt}
                settledAt={market.settledAt}
              />
            </GlassCardContent>
          </GlassCard>

          {/* Resolution source */}
          {market.resolutionSourceUrl && (
            <GlassCard>
              <GlassCardHeader>
                <h3 className="text-sm font-semibold">Resolution Source</h3>
              </GlassCardHeader>
              <GlassCardContent>
                <a
                  href={market.resolutionSourceUrl}
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
