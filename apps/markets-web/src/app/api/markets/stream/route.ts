import { NextRequest } from "next/server";
import { priceBroadcaster, type PriceUpdateEvent } from "@/lib/services/price-broadcaster";

// Heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_INTERVAL = 30000;

/**
 * SSE endpoint for real-time market price updates
 * 
 * Clients connect to this endpoint to receive price updates as they happen.
 * Supports optional filtering by eventId query parameter.
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

      // Helper to send SSE message
      const sendMessage = (data: object) => {
        const message = `data: ${JSON.stringify(data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream closed, ignore
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
        try {
          const message = `: heartbeat ${new Date().toISOString()}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch {
          // Stream closed, clean up
          clearInterval(heartbeat);
          unsubscribe();
        }
      }, HEARTBEAT_INTERVAL);

      // Handle client disconnect
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed
        }
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
