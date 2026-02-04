"use client";

import { useSession } from "@vault/auth/client";
import { useCallback } from "react";

/**
 * Hook that returns an authenticated fetch function.
 * With NextAuth, we rely on the session cookie being automatically
 * included in requests, but we also add the session token as a header
 * for API routes that need it.
 */
export function useAuthFetch() {
  const { data: session } = useSession();

  const authFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers);
      
      // Include credentials to ensure session cookies are sent
      return fetch(input, {
        ...init,
        headers,
        credentials: "include",
      });
    },
    [session]
  );

  return authFetch;
}
