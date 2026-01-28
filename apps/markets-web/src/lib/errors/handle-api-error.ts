import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "./api-errors";

/**
 * Standardized error response format
 */
interface ErrorResponse {
  error: string;
  details?: unknown;
}

/**
 * Handle errors and return appropriate NextResponse
 * 
 * Usage in API routes:
 * ```typescript
 * export async function POST(req: Request) {
 *   try {
 *     // ... logic
 *   } catch (error) {
 *     return handleApiError(error);
 *   }
 * }
 * ```
 */
export function handleApiError(error: unknown): NextResponse<ErrorResponse> {
  // Handle our custom API errors
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode }
    );
  }

  // Handle Zod validation errors
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.errors,
      },
      { status: 400 }
    );
  }

  // Handle auth errors from @vault/auth
  if (error instanceof Error) {
    if (error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message.includes("Admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // Log unexpected errors
  console.error("Unhandled error:", error);

  // Return generic 500 error (don't expose internal details)
  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}

/**
 * Wrap an async handler with error handling
 * 
 * Usage:
 * ```typescript
 * export const POST = withErrorHandler(async (req) => {
 *   // ... logic that might throw
 *   return NextResponse.json({ success: true });
 * });
 * ```
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
