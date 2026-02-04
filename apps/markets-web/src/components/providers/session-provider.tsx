"use client";

import { SessionProvider as NextAuthSessionProvider } from "@vault/auth/client";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}

