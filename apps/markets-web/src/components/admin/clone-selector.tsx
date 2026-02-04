"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Input,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Badge,
} from "@vault/ui";
import {
  Copy,
  Plus,
  Search,
  Calendar,
  Tag,
  ChevronRight,
  Loader2,
} from "lucide-react";
import type { MarketCategory } from "@vault/database";

// Types for the data we'll be working with
interface EventForClone {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  category: MarketCategory;
  bannerUrl: string | null;
  logoUrl: string | null;
  startTime: string | null;
  endTime: string | null;
  createdByKolId: string | null;
  tags: Array<{ id: string; label: string }>;
  markets: Array<{
    id: string;
    question: string;
    outcomes: string;
    feeBps: number;
    seed0: number;
    seed1: number;
    detailsMarkdown: string | null;
    resolutionSourceUrl: string | null;
  }>;
}

interface MarketForClone {
  id: string;
  question: string;
  outcomes: string;
  detailsMarkdown: string | null;
  resolutionSourceUrl: string | null;
  feeBps: number;
  seed0: number;
  seed1: number;
  event: {
    id: string;
    title: string;
    category: MarketCategory;
  };
}

// Props for the clone selector
interface CloneSelectorProps {
  type: "event" | "market";
  onSelect: (data: EventForClone | MarketForClone | null) => void;
  eventId?: string; // For market clone, optionally filter by event
}

export function CloneSelector({ type, onSelect, eventId }: CloneSelectorProps) {
  const [mode, setMode] = useState<"choice" | "selecting">("choice");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch events or markets based on type
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ["adminEventsForClone"],
    queryFn: async () => {
      const res = await fetch("/api/admin/events?limit=100");
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
    enabled: type === "event" && mode === "selecting",
  });

  const { data: marketsData, isLoading: marketsLoading } = useQuery({
    queryKey: ["adminMarketsForClone", eventId],
    queryFn: async () => {
      const url = eventId
        ? `/api/admin/markets?limit=100&event_id=${eventId}`
        : "/api/admin/markets?limit=100";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch markets");
      return res.json();
    },
    enabled: type === "market" && mode === "selecting",
  });

  const events: EventForClone[] = eventsData?.events || [];
  const markets: MarketForClone[] = marketsData?.markets || [];

  const isLoading = type === "event" ? eventsLoading : marketsLoading;

  // Filter based on search query
  const filteredEvents = events.filter(
    (event) =>
      event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredMarkets = markets.filter(
    (market) =>
      market.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      market.event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle create from scratch
  const handleCreateFromScratch = () => {
    onSelect(null);
  };

  // Handle selecting an item to clone
  const handleSelectItem = (item: EventForClone | MarketForClone) => {
    onSelect(item);
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Parse outcomes from JSON string
  const parseOutcomes = (outcomesJson: string): string[] => {
    try {
      return JSON.parse(outcomesJson);
    } catch {
      return ["Yes", "No"];
    }
  };

  // Choice screen
  if (mode === "choice") {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">
            How would you like to create this {type}?
          </h2>
          <p className="text-muted-foreground">
            Start fresh or clone from an existing {type} to save time
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Create from scratch option */}
          <GlassCard
            variant="solid"
            className="cursor-pointer hover:border-primary/50 transition-colors group"
            onClick={handleCreateFromScratch}
          >
            <GlassCardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Create from Scratch</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Start with a blank form and fill in all the details
                </p>
              </div>
              <Button variant="outline" className="mt-2">
                Start Fresh
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </GlassCardContent>
          </GlassCard>

          {/* Clone option */}
          <GlassCard
            variant="solid"
            className="cursor-pointer hover:border-primary/50 transition-colors group"
            onClick={() => setMode("selecting")}
          >
            <GlassCardContent className="p-6 flex flex-col items-center text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Copy className="h-8 w-8 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Clone Existing</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Copy settings from a previous {type} and modify as needed
                </p>
              </div>
              <Button variant="outline" className="mt-2">
                Browse {type === "event" ? "Events" : "Markets"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>
    );
  }

  // Selection screen
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">
            Select {type === "event" ? "Event" : "Market"} to Clone
          </h2>
          <p className="text-sm text-muted-foreground">
            Choose a {type} to use as a template
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMode("choice")}>
          Back
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={`Search ${type === "event" ? "events" : "markets"}...`}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="h-[400px] overflow-y-auto">
          <div className="space-y-2 pr-2">
            {type === "event" ? (
              filteredEvents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No events found
                </p>
              ) : (
                filteredEvents.map((event) => (
                  <GlassCard
                    key={event.id}
                    variant="solid"
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleSelectItem(event)}
                  >
                    <GlassCardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium truncate">
                              {event.title}
                            </h3>
                            <Badge variant="secondary" className="text-xs">
                              {event.category}
                            </Badge>
                          </div>
                          {event.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                              {event.description}
                            </p>
                          )}
                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                            {event.startTime && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDate(event.startTime)}
                              </span>
                            )}
                            {event.tags.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {event.tags.length} tag
                                {event.tags.length !== 1 ? "s" : ""}
                              </span>
                            )}
                            <span>
                              {event.markets.length} market
                              {event.markets.length !== 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                ))
              )
            ) : filteredMarkets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No markets found
              </p>
            ) : (
              filteredMarkets.map((market) => {
                const outcomes = parseOutcomes(market.outcomes);
                return (
                  <GlassCard
                    key={market.id}
                    variant="solid"
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => handleSelectItem(market)}
                  >
                    <GlassCardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium line-clamp-2">
                            {market.question}
                          </h3>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {outcomes[0]}
                            </Badge>
                            <span className="text-muted-foreground text-xs">
                              vs
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {outcomes[1]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Event: {market.event.title}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                      </div>
                    </GlassCardContent>
                  </GlassCard>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Create from scratch option at bottom */}
      <div className="pt-4 border-t border-border">
        <Button
          variant="ghost"
          className="w-full"
          onClick={handleCreateFromScratch}
        >
          <Plus className="h-4 w-4 mr-2" />
          Or create from scratch
        </Button>
      </div>
    </div>
  );
}

// Export types for use in pages
export type { EventForClone, MarketForClone };
