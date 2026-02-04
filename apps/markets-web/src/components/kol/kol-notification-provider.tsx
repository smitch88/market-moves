"use client";

import { useState, useCallback } from "react";
import { useSession, signIn } from "@vault/auth/client";
import { useKOLNotifications, type KOLBetNotification } from "@/hooks/use-kol-notifications";
import { KOLBetToastContainer } from "./kol-bet-toast";
import { QuickBetModal, type MarketData } from "@/components/events/quick-bet-modal";

/**
 * Global KOL notification provider
 * Listens to the KOL bets SSE stream and displays toast notifications
 */
export function KOLNotificationProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const [quickBetOpen, setQuickBetOpen] = useState(false);
  const [copyTradeData, setCopyTradeData] = useState<{
    eventId: string;
    eventTitle: string;
    market: MarketData;
    outcomeIndex: number;
  } | null>(null);

  const { notifications, dismissNotification } = useKOLNotifications({
    enabled: false, // Only connect if user is authenticated
  });

  const handleCopyTrade = useCallback((notification: KOLBetNotification) => {
    if (!authenticated) {
      signIn("twitter");
      return;
    }

    // Set up the copy trade data with the market info from the notification
    setCopyTradeData({
      eventId: notification.event.id,
      eventTitle: notification.event.title,
      market: {
        id: notification.market.id,
        question: notification.market.question,
        outcomes: JSON.stringify([notification.outcomeLabel, notification.outcomeIndex === 0 ? "No" : "Yes"]),
        status: "OPEN",
        closesAt: null,
        stats: {
          percent0: 50,
          percent1: 50,
          totalPool: 0,
        },
      },
      outcomeIndex: notification.outcomeIndex,
    });
    setQuickBetOpen(true);
  }, [authenticated]);

  return (
    <>
      {children}
      {/* {authenticated && notifications.length > 0 && (
        <KOLBetToastContainer
          notifications={notifications}
          onDismiss={dismissNotification}
          onCopyTrade={handleCopyTrade}
          maxVisible={3}
        />
      )} */}
      
      {/* Quick Bet Modal for Copy Trade */}
      {copyTradeData && (
        <QuickBetModal
          open={quickBetOpen}
          onOpenChange={(open) => {
            setQuickBetOpen(open);
            if (!open) setCopyTradeData(null);
          }}
          eventId={copyTradeData.eventId}
          eventTitle={copyTradeData.eventTitle}
          initialMarket={copyTradeData.market}
          initialOutcome={copyTradeData.outcomeIndex}
        />
      )}
    </>
  );
}
