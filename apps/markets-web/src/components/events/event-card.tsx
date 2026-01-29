"use client";

import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { Clock, TrendingUp, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import type { Event } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { getMarketUrl } from "@/lib/urls";

interface EventCardProps {
  event: Event & {
    _count: { markets: number };
    _aggregations: {
      totalVolume: number;
      totalBets: number;
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
      className="relative h-full"
    >
      <Link href={getMarketUrl(event.slug)} className="block group relative h-full">
        <motion.div
          className="relative overflow-hidden rounded-2xl bg-card/60 backdrop-blur-sm border border-border/40 shadow-lg hover:shadow-xl transition-shadow duration-300 h-full flex flex-col"
          whileHover={{
            y: -4,
            transition: { duration: 0.2, ease: "easeOut" },
          }}
          whileTap={{ scale: 0.98 }}
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
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/50 to-transparent" />

              {/* Category badge */}
              <div className="absolute top-3 right-3">
                <span className="px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/90 text-primary-foreground backdrop-blur-sm shadow-lg">
                  {event.category}
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-5 flex-1 flex flex-col">
            {/* Category when no banner */}
            {!event.bannerUrl && (
              <div className="mb-3">
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
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <BarChart3 className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{event._count.markets}</span>
                    <span className="text-muted-foreground/70">markets</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-foreground">{formatVolume(event._aggregations.totalVolume)}</span>
                  </div>
                </div>
                {endTime && (
                  <div
                    className={cn(
                      "flex items-center gap-1.5 font-medium",
                      isEndingSoon ? "text-red-500" : "text-muted-foreground"
                    )}
                  >
                    <Clock className="h-4 w-4" />
                    <span>{format(endTime, "MMM d")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </Link>
    </motion.div>
  );
}
