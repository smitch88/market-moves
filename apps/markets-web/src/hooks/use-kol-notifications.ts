"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface KOLBetNotification {
  id: string;
  kolUser: {
    id: string;
    name: string | null;
    handle: string | null;
    profileImageUrl: string | null;
  };
  market: {
    id: string;
    question: string;
  };
  event: {
    id: string;
    title: string;
    slug: string;
  };
  amount: number;
  outcomeIndex: number;
  outcomeLabel: string;
  createdAt: string;
}

interface SSEMessage {
  type: "connected" | "kol_bet" | "recent_bets";
  data?: KOLBetNotification | KOLBetNotification[];
}

interface UseKOLNotificationsOptions {
  /** Whether to connect to the SSE stream */
  enabled?: boolean;
  /** Callback when a new KOL bet is received */
  onNewBet?: (notification: KOLBetNotification) => void;
}

export function useKOLNotifications(options: UseKOLNotificationsOptions = {}) {
  const { enabled = true, onNewBet } = options;
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<KOLBetNotification[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onNewBetRef = useRef(onNewBet);

  // Keep the callback ref updated
  onNewBetRef.current = onNewBet;

  const connect = useCallback(() => {
    if (typeof window === "undefined" || eventSourceRef.current) {
      return;
    }

    const eventSource = new EventSource("/api/kol-bets/stream");
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      console.log("[KOL Notifications] Connected to SSE stream");
    };

    eventSource.onmessage = (event) => {
      try {
        const message: SSEMessage = JSON.parse(event.data);

        if (message.type === "connected") {
          console.log("[KOL Notifications] Connection confirmed");
        } else if (message.type === "recent_bets" && Array.isArray(message.data)) {
          // Initial batch of recent bets
          setNotifications(message.data);
        } else if (message.type === "kol_bet" && message.data && !Array.isArray(message.data)) {
          // New KOL bet notification
          const notification = message.data;
          setNotifications((prev) => [notification, ...prev].slice(0, 20)); // Keep last 20
          onNewBetRef.current?.(notification);
        }
      } catch (error) {
        console.error("[KOL Notifications] Failed to parse message:", error);
      }
    };

    eventSource.onerror = () => {
      console.log("[KOL Notifications] Connection error, will reconnect...");
      setIsConnected(false);
      eventSource.close();
      eventSourceRef.current = null;

      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (enabled) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    isConnected,
    notifications,
    dismissNotification,
    clearAllNotifications,
  };
}
