"use client";

import Link from "next/link";
import Image from "next/image";
import { format } from "date-fns";
import { Clock, TrendingUp, BarChart3, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import type { Event, MarketCategory } from "@vault/database";
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

// Check if event was created within last 48 hours
function isNewEvent(createdAt: Date | string): boolean {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const hoursSinceCreation = (Date.now() - created.getTime()) / (1000 * 60 * 60);
  return hoursSinceCreation < 48;
}

// Format volume for display
function formatVolume(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function EventCard({ event, index = 0 }: EventCardProps) {
  const isNew = isNewEvent(event.createdAt);
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
      {/* Animated gradient border for new events */}
      {isNew && (
        <div className="absolute -inset-[1px] rounded-xl bg-gradient-to-r from-emerald-500/50 via-cyan-500/50 to-emerald-500/50 opacity-60 blur-[2px] animate-gradient-shift" />
      )}

      <Link href={getMarketUrl(event.slug)} className="block group relative">
        <motion.div
          className={cn(
            "glass-card overflow-hidden h-full flex flex-col relative",
            isNew && "border-emerald-500/30"
          )}
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
              
              {/* Logo overlay */}
              {event.logoUrl && (
                <div className="absolute bottom-3 left-3">
                  <div className="h-12 w-12 rounded-lg overflow-hidden bg-background/80 backdrop-blur-sm border border-white/10">
                    <Image
                      src={event.logoUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="object-cover w-full h-full"
                    />
                  </div>
                </div>
              )}

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
            {/* Header without banner */}
            {!event.bannerUrl && (
              <div className="flex items-start gap-3 mb-3">
                {event.logoUrl ? (
                  <motion.div
                    className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0"
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Image
                      src={event.logoUrl}
                      alt=""
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    className={cn(
                      "h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0",
                      isNew
                        ? "bg-gradient-to-br from-emerald-500/30 to-cyan-500/20"
                        : "bg-gradient-to-br from-primary/30 to-primary/10"
                    )}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    {isNew ? (
                      <Sparkles className="h-5 w-5 text-emerald-400" />
                    ) : (
                      <TrendingUp className="h-5 w-5 text-primary" />
                    )}
                  </motion.div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      {event.category}
                    </span>
                    {isNew && (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-emerald-400 border border-emerald-500/30"
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        New
                      </motion.span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Title */}
            <h3
              className={cn(
                "font-semibold text-lg leading-tight mb-2 transition-colors",
                isNew ? "group-hover:text-emerald-400" : "group-hover:text-primary",
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
