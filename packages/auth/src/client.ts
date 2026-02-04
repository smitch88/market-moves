"use client";

// Re-export client-side auth utilities from next-auth/react
// This provides a consistent import path across the app
export {
  useSession,
  signIn,
  signOut,
  SessionProvider,
  getCsrfToken,
  getProviders,
  getSession,
} from "next-auth/react";

// Re-export types
export type { SessionProviderProps } from "next-auth/react";

