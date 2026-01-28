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
      className="relative"
    >
      <Link href={getMarketUrl(event.slug)} className="block group relative">
        <motion.div
          className="relative overflow-hidden rounded-lg border bg-white/5 backdrop-blur-md border-white/10 shadow-xl h-full flex flex-col"
          whileHover={{
            y: -4,
            transition: { duration: 0.2, ease: "easeOut" },
          }}
          whileTap={{ scale: 0.98 }}
        >
          {/* Banner Image */}
          {event.bannerUrl && (
            <div className="relative h-32 w-full overflow-hidden">
              <Image
                src={event.bannerUrl}
                alt=""
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent" />

              {/* Category badge */}
              <div className="absolute top-3 right-3">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-background/80 backdrop-blur-sm border border-white/10">
                  {event.category}
                </span>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="p-4 flex-1 flex flex-col">
            {/* Category when no banner */}
            {!event.bannerUrl && (
              <div className="mb-2">
                <span className="text-xs text-muted-foreground font-medium">
                  {event.category}
                </span>
              </div>
            )}

            {/* Title */}
            <h3
              className={cn(
                "font-semibold text-lg leading-tight mb-2 transition-colors group-hover:text-primary",
                event.bannerUrl && "mt-1"
              )}
            >
              {event.title}
            </h3>

            {/* Description */}
            {event.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                {event.description}
              </p>
            )}

            {/* Stats */}
            <div className="mt-auto pt-3 border-t border-border/50">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="font-medium">{event._count.markets} markets</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>{formatVolume(event._aggregations.totalVolume)} Vol</span>
                  </div>
                </div>
                {endTime && (
                  <div
                    className={cn(
                      "flex items-center gap-1",
                      isEndingSoon && "text-red-500"
                    )}
                  >
                    <Clock className="h-3.5 w-3.5" />
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
