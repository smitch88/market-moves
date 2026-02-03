"use client";

import { useHeartbeat } from "@/hooks/use-heartbeat";

/**
 * Provider component that starts the heartbeat tracking.
 * Sends periodic heartbeats to track active users.
 */
export function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  useHeartbeat();
  return <>{children}</>;
}
