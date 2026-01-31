"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@vault/ui";
import { Star, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type KOLBetNotification } from "@/hooks/use-kol-notifications";
import { cn } from "@vault/ui/lib/utils";

interface KOLBetToastProps {
  notification: KOLBetNotification;
  onDismiss: (id: string) => void;
  autoDismissMs?: number;
}

export function KOLBetToast({
  notification,
  onDismiss,
  autoDismissMs = 10000, // 10 seconds
}: KOLBetToastProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Auto-dismiss after specified time
  useEffect(() => {
    if (isHovered) return;

    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [notification.id, autoDismissMs, onDismiss, isHovered]);

  const displayName = notification.kolUser.name || notification.kolUser.handle || "KOL";
  const handle = notification.kolUser.handle;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "relative w-80 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden",
        "ring-1 ring-yellow-500/20"
      )}
    >
      {/* Progress bar for auto-dismiss */}
      {!isHovered && (
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: autoDismissMs / 1000, ease: "linear" }}
          className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-yellow-500 to-orange-500"
        />
      )}

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(notification.id)}
        className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-4">
        {/* Header with KOL avatar and name */}
        <div className="flex items-center gap-3 mb-3">
          <div className="relative">
            <Avatar className="h-10 w-10">
              <AvatarImage src={notification.kolUser.profileImageUrl || undefined} />
              <AvatarFallback className="bg-[#df2421]/10 text-[#df2421]">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-1 -right-1 bg-[#df2421] rounded-full p-0.5 border border-background">
              <Star className="w-2.5 h-2.5 text-white fill-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{displayName}</span>
              <span className="text-xs text-[#df2421]">Captain</span>
            </div>
            {handle && (
              <span className="text-xs text-muted-foreground">@{handle}</span>
            )}
          </div>
        </div>

        {/* Bet details */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            just predicted on
          </p>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <p className="text-sm font-medium line-clamp-2">
              {notification.market.question}
            </p>
            <div className="flex items-center justify-between">
              <span className={cn(
                "text-sm font-semibold",
                notification.outcomeIndex === 0 ? "text-emerald-500" : "text-red-500"
              )}>
                {notification.outcomeLabel}
              </span>
              <span className="text-sm font-mono font-semibold text-[#df2421]">
                ${notification.amount.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-8"
          >
            <Link href={`/events/${notification.event.slug}`}>
              <ExternalLink className="w-3 h-3 mr-1.5" />
              View Market
            </Link>
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Container for multiple KOL bet toasts
 */
interface KOLBetToastContainerProps {
  notifications: KOLBetNotification[];
  onDismiss: (id: string) => void;
  maxVisible?: number;
}

export function KOLBetToastContainer({
  notifications,
  onDismiss,
  maxVisible = 3,
}: KOLBetToastContainerProps) {
  const visibleNotifications = notifications.slice(0, maxVisible);

  return (
    <div className="fixed bottom-20 right-4 z-50 flex flex-col-reverse gap-3">
      <AnimatePresence mode="popLayout">
        {visibleNotifications.map((notification) => (
          <KOLBetToast
            key={notification.id}
            notification={notification}
            onDismiss={onDismiss}
          />
        ))}
      </AnimatePresence>
      
      {notifications.length > maxVisible && (
        <div className="text-xs text-muted-foreground text-center py-1">
          +{notifications.length - maxVisible} more notifications
        </div>
      )}
    </div>
  );
}
