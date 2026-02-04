"use client";

import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { Clock, TrendingUp, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import type { Event, MarketCategory, EventType } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@vault/ui";
import { getMarketUrl } from "@/lib/urls";
import { QuickBetButton } from "./quick-bet-button";
import { BookmarkButton } from "./bookmark-button";

// Event type that accepts both Date and string for date fields (API serialization)
type SerializedEvent = Omit<Event, 'createdAt' | 'updatedAt' | 'startTime' | 'endTime'> & {
  createdAt: Date | string;
  updatedAt: Date | string;
  startTime: Date | string | null;
  endTime: Date | string | null;
};

// KOL creator info
interface KOLCreator {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
}

interface EventCardCompactProps {
  event: SerializedEvent & {
    _count: { markets: number };
    _aggregations: {
      totalVolume: number;
      totalBets: number;
      totalVerifications?: number;
      earliestClose?: string | null;
    };
    createdByKol?: KOLCreator | null;
  };
  index?: number;
}

// Format volume for display
function formatVolume(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

// Format date in user's local timezone
function formatDateLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function EventCardCompact({ event, index = 0 }: EventCardCompactProps) {
  const endTime = event.endTime ? new Date(event.endTime) : null;
  const isEndingSoon = endTime && endTime.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.03,
        ease: [0.25, 0.1, 0.25, 1] as const,
      }}
      whileHover={{
        y: -2,
        transition: { duration: 0.15, ease: "easeOut" },
      }}
      whileTap={{ scale: 0.98 }}
      className="relative h-full"
    >
      <Link href={getMarketUrl(event.slug)} className="block group relative h-full">
        <div
          className="relative overflow-hidden rounded-xl bg-card/60 backdrop-blur-sm border border-border/40 shadow-md hover:shadow-lg transition-shadow duration-200 h-full flex flex-col"
        >
          {/* Banner Image - smaller for compact card */}
          {event.bannerUrl && (
            <div className="relative h-24 w-full overflow-hidden">
              <Image
                src={event.bannerUrl}
                alt=""
                fill
                className="object-cover transition-transform duration-200 group-hover:scale-105"
              />
              {/* Gradient overlay */}
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/30 to-transparent" />

              {/* Category badge */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                {endTime && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold backdrop-blur-sm cursor-help",
                          isEndingSoon
                            ? "bg-primary/90 text-primary-foreground"
                            : "bg-black/60 text-white"
                        )}>
                          <Clock className="h-3 w-3" />
                          <span>{format(endTime, "MMM d")}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-card border border-border text-foreground">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Ends at (your time)</p>
                          <p className="font-medium text-xs">{formatDateLocal(endTime)}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-black/60 text-white backdrop-blur-sm">
                  {event.category}
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-3 flex-1 flex flex-col">
            {/* Category when no banner */}
            {!event.bannerUrl && (
              <div className="mb-2 flex items-center gap-1.5">
                {endTime && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold cursor-help",
                          isEndingSoon
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-muted text-muted-foreground border border-border"
                        )}>
                          <Clock className="h-3 w-3" />
                          <span>{format(endTime, "MMM d")}</span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="bg-card border border-border text-foreground">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Ends at (your time)</p>
                          <p className="font-medium text-xs">{formatDateLocal(endTime)}</p>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <span className="px-2 py-1 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground border border-border">
                  {event.category}
                </span>
              </div>
            )}

            {/* Title */}
            <h3 className="font-semibold text-sm leading-tight text-foreground group-hover:text-primary transition-colors line-clamp-2 flex-1">
              {event.title}
            </h3>

            {/* Made by badge - compact */}
            {event.createdByKol && (
              <div className="flex items-center gap-1 mt-2">
                <span className="text-[10px] text-muted-foreground">by</span>
                <Avatar className="h-3.5 w-3.5">
                  <AvatarImage src={event.createdByKol.profileImageUrl || undefined} />
                  <AvatarFallback className="bg-primary/20 text-primary text-[8px]">
                    {(event.createdByKol.name || event.createdByKol.handle || "K")[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-[10px] text-muted-foreground truncate max-w-[60px]">
                  @{event.createdByKol.handle}
                </span>
              </div>
            )}

            {/* Stats */}
            <div className="pt-2 border-t border-border/50 mt-2">
              <div className="flex items-center justify-between text-[10px] gap-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <BarChart3 className="h-3 w-3 text-primary flex-shrink-0" />
                    <span className="font-medium">{event._count.markets}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-primary flex-shrink-0" />
                    <span className="font-semibold text-foreground">{formatVolume(event._aggregations.totalVolume)}</span>
                  </div>
                </div>
                {/* Spacer for buttons */}
                <div className="w-[70px] flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </Link>
      
      {/* Action buttons - positioned outside Link */}
      <div className="absolute bottom-2 right-2 flex items-center gap-1 z-10">
        <BookmarkButton eventId={event.id} className="w-6 h-6" />
        <QuickBetButton eventId={event.id} eventTitle={event.title} size="sm" />
      </div>
    </motion.div>
  );
}
