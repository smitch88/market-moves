"use client";

import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { Clock, TrendingUp, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import type { Event, MarketCategory, EventType } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
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

interface EventCardProps {
  event: SerializedEvent & {
    _count: { markets: number };
    _aggregations: {
      totalVolume: number;
      totalBets: number;
      totalVerifications?: number;
      earliestClose?: string | null;
    };
  };
  index?: number;
}

// Format volume for display
function formatVolume(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function EventCard({ event, index = 0 }: EventCardProps) {
  const endTime = event.endTime ? new Date(event.endTime) : null;
  const isEndingSoon = endTime && endTime.getTime() - Date.now() < 24 * 60 * 60 * 1000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.25, 0.1, 0.25, 1] as const,
      }}
      whileHover={{
        y: -4,
        transition: { duration: 0.2, ease: "easeOut" },
      }}
      whileTap={{ scale: 0.98 }}
      className="relative h-full"
    >
      <Link href={getMarketUrl(event.slug)} className="block group relative h-full">
        <div
          className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-sm border border-border/40 shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col"
        >
          {/* Banner Image */}
          {event.bannerUrl && (
            <div className="relative h-36 w-full overflow-hidden">
              <Image
                src={event.bannerUrl}
                alt=""
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Very subtle gradient only at the bottom edge for text readability */}
              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />

              {/* Category badge and date */}
              <div className="absolute top-3 right-3 flex items-center gap-2">
                {endTime && (
                  <div
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm shadow-lg",
                      isEndingSoon 
                        ? "bg-red-500/90 text-white" 
                        : "bg-black/60 text-white"
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{format(endTime, "MMM d")}</span>
                  </div>
                )}
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/90 text-primary-foreground backdrop-blur-sm shadow-lg">
                  {event.category}
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-5 flex-1 flex flex-col">
            {/* Category and date when no banner */}
            {!event.bannerUrl && (
              <div className="mb-3 flex items-center gap-2">
                {endTime && (
                  <div
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold",
                      isEndingSoon 
                        ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                        : "bg-muted text-muted-foreground border border-border"
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{format(endTime, "MMM d")}</span>
                  </div>
                )}
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                  {event.category}
                </span>
              </div>
            )}

            {/* Title */}
            <h3
              className={cn(
                "font-bold text-lg leading-tight mb-3 text-foreground group-hover:text-primary transition-colors line-clamp-2 min-h-[3.5rem]",
                event.bannerUrl && "mt-1"
              )}
            >
              {event.title}
            </h3>

            {/* Description - always render container for consistent height */}
            <div className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1 min-h-[2.5rem]">
              {event.description || " "}
            </div>

            {/* Stats */}
            <div className="mt-auto pt-4 border-t border-border/50">
              <div className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 xs:gap-3 min-w-0 flex-wrap">
                  <div className="flex items-center gap-1 xs:gap-1.5 text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-primary flex-shrink-0" />
                    <span className="font-semibold">{event._count.markets}</span>
                    <span className="text-muted-foreground/70 hidden xs:inline">markets</span>
                  </div>
                  <div className="flex items-center gap-1 xs:gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-primary flex-shrink-0" />
                    <span className="font-semibold text-foreground">{formatVolume(event._aggregations.totalVolume)}</span>
                  </div>
                </div>
                {/* Placeholder for button spacing - responsive */}
                <div className="w-[100px] xs:w-[140px] flex-shrink-0" />
              </div>
            </div>
          </div>
        </div>
      </Link>
      
      {/* Action buttons - positioned outside Link to prevent click propagation */}
      <div className="absolute bottom-[0.75rem] right-3 xs:right-5 flex items-center gap-1.5 xs:gap-2 z-10">
        <BookmarkButton eventId={event.id} className="w-7 h-7 xs:w-8 xs:h-8" />
        <QuickBetButton eventId={event.id} eventTitle={event.title} />
      </div>
    </motion.div>
  );
}
