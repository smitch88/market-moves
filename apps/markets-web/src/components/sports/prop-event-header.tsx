"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Calendar, TrendingUp, Zap, Clock, ChevronDown } from "lucide-react";
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

// Countdown hook - ensures no hydration mismatch by starting null
function useCountdown(targetDate: Date | null) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  
  // Convert to timestamp for stable comparison (Date objects change identity on every render)
  const targetTimestamp = targetDate ? new Date(targetDate).getTime() : null;

  // Mark as mounted after first render (client-side only)
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    // Only run on client side after mount
    if (!isMounted) {
      return;
    }
    
    // No target date
    if (!targetTimestamp || isNaN(targetTimestamp)) {
      setTimeLeft(null);
      return;
    }

    const calculateTimeLeft = () => {
      const now = Date.now();
      const difference = targetTimestamp - now;

      if (difference <= 0) {
        return null;
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
      };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      const result = calculateTimeLeft();
      setTimeLeft(result);
      
      // Clear interval if countdown finished
      if (!result) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [targetTimestamp, isMounted]);

  return timeLeft;
}

export function PropEventHeader({ event }: PropEventHeaderProps) {
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isDescriptionTruncated, setIsDescriptionTruncated] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);

  // Calculate total volume
  const totalVolume = event.markets.reduce((sum, m) => {
    return sum + Number(m.seed0 || 0) + Number(m.seed1 || 0) + Number(m.pool0 || 0) + Number(m.pool1 || 0);
  }, 0);

  const eventDate = event.endTime || event.startTime;
  const totalMarkets = event.markets.length;
  
  // Countdown to resolution
  const timeLeft = useCountdown(eventDate ? new Date(eventDate) : null);

  // Check if description is truncated
  useEffect(() => {
    const checkTruncation = () => {
      if (descriptionRef.current) {
        const isOverflowing = descriptionRef.current.scrollHeight > descriptionRef.current.clientHeight;
        setIsDescriptionTruncated(isOverflowing);
      }
    };

    checkTruncation();
    window.addEventListener("resize", checkTruncation);
    return () => window.removeEventListener("resize", checkTruncation);
  }, [event.description]);

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
            <div className="hidden sm:block w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden bg-card border-2 border-background shadow-lg shrink-0">
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

            {/* Description with read more */}
            {event.description && (
              <div className="mt-1.5 sm:mt-2">
                <p 
                  ref={descriptionRef}
                  className={`text-xs sm:text-sm text-muted-foreground ${
                    isDescriptionExpanded ? "" : "line-clamp-2"
                  }`}
                >
                  {event.description}
                </p>
                
                {/* Read more button - only shown when truncated */}
                {(isDescriptionTruncated || isDescriptionExpanded) && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="inline-flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 transition-colors mt-0.5"
                  >
                    <span>{isDescriptionExpanded ? "Show less" : "Read more"}</span>
                    <motion.div
                      animate={{ rotate: isDescriptionExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </motion.div>
                  </button>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Countdown timer - prominent display */}
        {timeLeft && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-xl bg-primary/10 border border-primary/20"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <span className="text-xs sm:text-sm text-muted-foreground">Resolution in</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1 sm:gap-2">
                  {timeLeft.days > 0 && (
                    <div className="flex flex-col items-center">
                      <span className="text-lg sm:text-2xl font-bold font-mono text-foreground">
                        {timeLeft.days}
                      </span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">days</span>
                    </div>
                  )}
                  {(timeLeft.days > 0 || timeLeft.hours > 0) && (
                    <>
                      {timeLeft.days > 0 && <span className="text-lg sm:text-2xl font-bold text-muted-foreground/50">:</span>}
                      <div className="flex flex-col items-center">
                        <span className="text-lg sm:text-2xl font-bold font-mono text-foreground">
                          {timeLeft.hours.toString().padStart(2, "0")}
                        </span>
                        <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">hrs</span>
                      </div>
                    </>
                  )}
                  <span className="text-lg sm:text-2xl font-bold text-muted-foreground/50">:</span>
                  <div className="flex flex-col items-center">
                    <span className="text-lg sm:text-2xl font-bold font-mono text-foreground">
                      {timeLeft.minutes.toString().padStart(2, "0")}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">min</span>
                  </div>
                  <span className="text-lg sm:text-2xl font-bold text-muted-foreground/50">:</span>
                  <div className="flex flex-col items-center">
                    <span className="text-lg sm:text-2xl font-bold font-mono text-primary">
                      {timeLeft.seconds.toString().padStart(2, "0")}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground uppercase">sec</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

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
              {/* Mobile: short date */}
              <span className="text-muted-foreground sm:hidden">
                {timeLeft ? "Ends" : "Ended"} {format(new Date(eventDate), "MMM d, yyyy")}
              </span>
              {/* Desktop: full timestamp with UTC */}
              <span className="text-muted-foreground hidden sm:inline">
                {timeLeft ? "Ends" : "Ended"} {format(new Date(eventDate), "MMM d, yyyy 'at' h:mm a")} UTC
              </span>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
