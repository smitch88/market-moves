"use client";

import { useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

// Heartbeat interval: 60 seconds
const HEARTBEAT_INTERVAL_MS = 60 * 1000;

/**
 * Hook for sending periodic heartbeats to track user activity.
 * Only sends heartbeats when:
 * - User is authenticated
 * - Tab is visible (using Page Visibility API)
 */
export function useHeartbeat() {
  const { authenticated, ready } = usePrivy();
  const authFetch = useAuthFetch();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    // Only start heartbeat when authenticated
    if (!ready || !authenticated) {
      return;
    }

    const sendHeartbeat = async () => {
      // Don't send heartbeat if tab is hidden
      if (!isVisibleRef.current) {
        return;
      }

      try {
        await authFetch("/api/heartbeat", {
          method: "POST",
        });
      } catch (error) {
        // Silently ignore heartbeat errors to avoid console spam
        // The server handles throttling, so occasional failures are fine
        console.debug("[Heartbeat] Failed:", error);
      }
    };

    // Handle visibility changes
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";
      
      // Send immediate heartbeat when tab becomes visible
      if (isVisibleRef.current) {
        sendHeartbeat();
      }
    };

    // Set initial visibility state
    if (typeof document !== "undefined") {
      isVisibleRef.current = document.visibilityState === "visible";
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    // Send initial heartbeat
    sendHeartbeat();

    // Set up interval
    intervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
    };
  }, [ready, authenticated, authFetch]);
}
