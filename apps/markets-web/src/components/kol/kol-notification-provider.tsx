"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useKOLNotifications } from "@/hooks/use-kol-notifications";
import { KOLBetToastContainer } from "./kol-bet-toast";

/**
 * Global KOL notification provider
 * Listens to the KOL bets SSE stream and displays toast notifications
 */
export function KOLNotificationProvider({ children }: { children: React.ReactNode }) {
  const { authenticated } = usePrivy();

  const { notifications, dismissNotification } = useKOLNotifications({
    enabled: authenticated, // Only connect if user is authenticated
  });

  return (
    <>
      {children}
      {authenticated && notifications.length > 0 && (
        <KOLBetToastContainer
          notifications={notifications}
          onDismiss={dismissNotification}
          maxVisible={3}
        />
      )}
    </>
  );
}
