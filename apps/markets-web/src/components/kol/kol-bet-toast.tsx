"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@vault/ui";
import { Star, X, ExternalLink, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type KOLBetNotification } from "@/hooks/use-kol-notifications";
import { cn } from "@vault/ui/lib/utils";

interface KOLBetToastProps {
  notification: KOLBetNotification;
  onDismiss: (id: string) => void;
  onCopyTrade?: (notification: KOLBetNotification) => void;
  autoDismissMs?: number;
  /** Stack index for positioning (0 = front, higher = further back) */
  stackIndex?: number;
  /** Whether this card is expanded/active */
  isExpanded?: boolean;
  /** Callback to expand this card */
  onExpand?: () => void;
}

export function KOLBetToast({
  notification,
  onDismiss,
  onCopyTrade,
  autoDismissMs = 10000, // 10 seconds
  stackIndex = 0,
  isExpanded = true,
  onExpand,
}: KOLBetToastProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Auto-dismiss after specified time (only for front card)
  useEffect(() => {
    if (isHovered || stackIndex > 0) return;

    const timer = setTimeout(() => {
      onDismiss(notification.id);
    }, autoDismissMs);

    return () => clearTimeout(timer);
  }, [notification.id, autoDismissMs, onDismiss, isHovered, stackIndex]);

  const displayName = notification.kolUser.name || notification.kolUser.handle || "KOL";
  const handle = notification.kolUser.handle;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();

  // Calculate stack position transforms
  const stackOffset = stackIndex * 8; // 8px vertical offset per card
  const stackScale = 1 - (stackIndex * 0.03); // Slightly smaller per card
  const stackOpacity = 1 - (stackIndex * 0.15); // Slightly faded per card

  return (
    <motion.div
      initial={{ opacity: 0, x: 100, scale: 0.95 }}
      animate={{ 
        opacity: isExpanded ? 1 : stackOpacity, 
        x: 0, 
        scale: isExpanded ? 1 : stackScale,
        y: isExpanded ? 0 : -stackOffset,
      }}
      exit={{ opacity: 0, x: 100, scale: 0.95 }}
      transition={{ type: "spring", damping: 25, stiffness: 300 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={!isExpanded && onExpand ? onExpand : undefined}
      style={{ zIndex: 10 - stackIndex }}
      className={cn(
        "relative w-72 bg-card/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden",
        "ring-1 ring-[#df2421]/20",
        !isExpanded && "cursor-pointer hover:ring-[#df2421]/40"
      )}
    >
      {/* Progress bar for auto-dismiss */}
      {!isHovered && (
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: autoDismissMs / 1000, ease: "linear" }}
          className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-[#df2421] to-orange-500"
        />
      )}

      {/* Dismiss button */}
      <button
        onClick={() => onDismiss(notification.id)}
        className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="p-3">
        {/* Header with KOL avatar and name */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="relative">
            <Avatar className="h-8 w-8">
              <AvatarImage src={notification.kolUser.profileImageUrl || undefined} />
              <AvatarFallback className="bg-[#df2421]/10 text-[#df2421] text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 bg-[#df2421] rounded-full p-0.5 border border-background">
              <Star className="w-2 h-2 text-white fill-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm truncate">{displayName}</span>
              <span className="text-[10px] text-[#df2421]">Captain</span>
            </div>
            {handle && (
              <span className="text-[10px] text-muted-foreground">@{handle}</span>
            )}
          </div>
        </div>

        {/* Bet details - more compact */}
        <div className="bg-muted/50 rounded-lg p-2.5 mb-2.5">
          <p className="text-xs font-medium line-clamp-1 mb-1.5">
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

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            asChild
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-7"
          >
            <Link href={`/markets/${notification.event.slug}`}>
              <ExternalLink className="w-3 h-3 mr-1" />
              View
            </Link>
          </Button>
          {onCopyTrade && (
            <Button
              size="sm"
              className="flex-1 text-xs h-7 bg-[#df2421] hover:bg-[#bf1f1c] text-white"
              onClick={() => {
                onCopyTrade(notification);
                onDismiss(notification.id);
              }}
            >
              <Copy className="w-3 h-3 mr-1" />
              Copy Trade
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Container for multiple KOL bet toasts - stacked card layout
 */
interface KOLBetToastContainerProps {
  notifications: KOLBetNotification[];
  onDismiss: (id: string) => void;
  onCopyTrade?: (notification: KOLBetNotification) => void;
  maxVisible?: number;
}

export function KOLBetToastContainer({
  notifications,
  onDismiss,
  onCopyTrade,
  maxVisible = 4,
}: KOLBetToastContainerProps) {
  const [expandedIndex, setExpandedIndex] = useState(0);
  const visibleNotifications = notifications.slice(0, maxVisible);

  // Reset expanded index when notifications change
  useEffect(() => {
    setExpandedIndex(0);
  }, [notifications.length]);

  if (visibleNotifications.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {/* Stacked cards container */}
      <div className="relative" style={{ height: visibleNotifications.length > 1 ? 'auto' : undefined }}>
        <AnimatePresence mode="popLayout">
          {visibleNotifications.map((notification, index) => (
            <div
              key={notification.id}
              className={cn(
                index === 0 ? "relative" : "absolute bottom-0 right-0"
              )}
              style={{ 
                zIndex: maxVisible - index,
              }}
            >
              <KOLBetToast
                notification={notification}
                onDismiss={onDismiss}
                onCopyTrade={onCopyTrade}
                stackIndex={index}
                isExpanded={index === expandedIndex}
                onExpand={() => setExpandedIndex(index)}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
      
      {/* Stack indicator */}
      {notifications.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {visibleNotifications.map((_, index) => (
            <button
              key={index}
              onClick={() => setExpandedIndex(index)}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all",
                index === expandedIndex 
                  ? "bg-[#df2421] w-4" 
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
            />
          ))}
          {notifications.length > maxVisible && (
            <span className="text-[10px] text-muted-foreground ml-1">
              +{notifications.length - maxVisible}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
