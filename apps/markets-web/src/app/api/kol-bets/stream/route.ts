import { NextRequest } from "next/server";
import { getRecentKOLBetNotifications } from "@/lib/services/kol-service";

// Store active SSE connections
const connections = new Set<ReadableStreamDefaultController>();

/**
 * Broadcast a KOL bet notification to all connected clients
 */
export function broadcastKOLBet(notification: {
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
  createdAt: Date;
}) {
  const data = JSON.stringify({
    type: "kol_bet",
    data: notification,
  });

  connections.forEach((controller) => {
    try {
      controller.enqueue(`data: ${data}\n\n`);
    } catch {
      // Connection may be closed, will be cleaned up
      connections.delete(controller);
    }
  });
}

/**
 * GET /api/kol-bets/stream
 * 
 * Server-Sent Events endpoint for real-time KOL bet notifications.
 * Clients connect here to receive notifications when KOLs place bets.
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Add this connection to the set
      connections.add(controller);

      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));

      // Send recent KOL bets (last 5) on connect so client has context
      try {
        const recentBets = await getRecentKOLBetNotifications(5);
        if (recentBets.length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "recent_bets", data: recentBets })}\n\n`
            )
          );
        }
      } catch (error) {
        console.error("Error fetching recent KOL bets:", error);
      }

      // Keep connection alive with heartbeat
      const heartbeatInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          clearInterval(heartbeatInterval);
          connections.delete(controller);
        }
      }, 30000); // Every 30 seconds

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeatInterval);
        connections.delete(controller);
        controller.close();
      });
    },
    cancel() {
      // Called when the stream is cancelled
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

/**
 * Get the number of active SSE connections
 */
export function getActiveConnectionCount(): number {
  return connections.size;
}
