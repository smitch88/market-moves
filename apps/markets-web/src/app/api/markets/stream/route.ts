import { NextRequest } from "next/server";
import { priceBroadcaster, type PriceUpdateEvent } from "@/lib/services/price-broadcaster";

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

// Maximum connection duration (4 minutes - under Vercel's 5 min limit)
// This gives us buffer before Vercel's timeout kicks in
const MAX_CONNECTION_DURATION = 4 * 60 * 1000;

/**
 * SSE endpoint for real-time market price updates
 * 
 * Clients connect to this endpoint to receive price updates as they happen.
 * Supports optional filtering by eventId query parameter.
 * 
 * Note: Connections are automatically closed after MAX_CONNECTION_DURATION
 * to avoid Vercel timeout errors. Clients should reconnect automatically.
 * 
 * Usage: GET /api/markets/stream?eventId=optional-event-id
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const eventIdFilter = searchParams.get("eventId");

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let isClosed = false;

      // Helper to send SSE message
      const sendMessage = (data: object) => {
        if (isClosed) return;
        const message = `data: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream closed, ignore
          isClosed = true;
        }
      };

      // Cleanup function
      const cleanup = (heartbeat: NodeJS.Timeout, connectionTimeout: NodeJS.Timeout, unsubscribe: () => void) => {
        if (isClosed) return;
        isClosed = true;
        clearInterval(heartbeat);
        clearTimeout(connectionTimeout);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      // Send initial connection confirmation
      sendMessage({ type: "connected", timestamp: new Date().toISOString() });

      // Subscribe to price updates
      const unsubscribe = priceBroadcaster.subscribe((event: PriceUpdateEvent) => {
        // Filter by eventId if specified
        if (eventIdFilter && event.eventId !== eventIdFilter) {
          return;
        }
        sendMessage(event);
      });

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (isClosed) return;
        try {
          const message = `: heartbeat ${new Date().toISOString()}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream closed, clean up will happen via abort handler
          isClosed = true;
        }
      }, HEARTBEAT_INTERVAL);

      // Auto-close connection before Vercel timeout
      // Send reconnect message so client knows to reconnect
      const connectionTimeout = setTimeout(() => {
        sendMessage({ 
          type: "reconnect", 
          reason: "max_duration",
          timestamp: new Date().toISOString() 
        });
        cleanup(heartbeat, connectionTimeout, unsubscribe);
      }, MAX_CONNECTION_DURATION);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        cleanup(heartbeat, connectionTimeout, unsubscribe);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

// Disable body parsing for this route
export const dynamic = "force-dynamic";
