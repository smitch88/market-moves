"use client";

import Image from "next/image";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar, TrendingUp, Zap, Tag } from "lucide-react";
import type { Event, Market } from "@vault/database";
import { Badge } from "@vault/ui";

interface PropEventHeaderProps {
  event: Event & {
    markets: Market[];
    tags?: { id: string; slug: string; label: string }[];
  };
}

// Format volume for display
function formatVolume(v: number): string {
  if (v >= 1000000) return `$${(v / 1000000).toFixed(2)}M`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

export function PropEventHeader({ event }: PropEventHeaderProps) {
  // Calculate total volume
  const totalVolume = event.markets.reduce((sum, m) => {
    return sum + (m.seed0 || 0) + (m.seed1 || 0) + (m.pool0 || 0) + (m.pool1 || 0);
  }, 0);

  const eventDate = event.endTime || event.startTime;
  const totalMarkets = event.markets.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-card via-card to-card/80 border border-border/50"
    >
      {/* Banner image */}
      {event.bannerUrl && (
        <div className="relative h-32 sm:h-40 md:h-48 w-full">
          <Image
            src={event.bannerUrl}
            alt={event.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/60 to-transparent" />
        </div>
      )}

      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 pointer-events-none" />

      <div className={`relative p-4 sm:p-6 ${event.bannerUrl ? "-mt-16 sm:-mt-20" : ""}`}>
        {/* Logo + Title section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex items-start gap-3 sm:gap-4"
        >
          {event.logoUrl && (
            <div className="w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-xl overflow-hidden bg-card border-2 border-background shadow-lg shrink-0">
              <Image
                src={event.logoUrl}
                alt=""
                width={80}
                height={80}
                className="object-cover w-full h-full"
              />
            </div>
          )}

          <div className="flex-1 min-w-0">
            {/* Category + Tags */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2 flex-wrap"
            >
              <Badge variant="secondary" className="uppercase tracking-wider text-[10px] sm:text-xs">
                {event.category}
              </Badge>
              {event.tags?.map((tag) => (
                <Badge key={tag.id} variant="outline" className="text-[10px] sm:text-xs">
                  {tag.label}
                </Badge>
              ))}
            </motion.div>

            {/* Title */}
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-foreground line-clamp-2">
              {event.title}
            </h1>

            {/* Description */}
            {event.description && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 sm:mt-2 line-clamp-2">
                {event.description}
              </p>
            )}
          </div>
        </motion.div>

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 sm:gap-6 mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-border/50 flex-wrap"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            <span className="text-muted-foreground">Volume</span>
            <span className="font-bold">{formatVolume(totalVolume)}</span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <Zap className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            <span className="text-muted-foreground">Markets</span>
            <span className="font-bold">{totalMarkets}</span>
          </div>

          {eventDate && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Ends {format(new Date(eventDate), "MMM d, yyyy")}
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
