"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@vault/ui/lib/utils";
import { CaptainSelector, CAPTAIN_ONBOARDING_DISMISS_KEY, CAPTAIN_ONBOARDING_DISMISS_MS } from "./captain-selector";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

const isDev = process.env.NODE_ENV === "development";

function shouldShowPromptFromLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  const dismissedAtRaw = window.localStorage.getItem(CAPTAIN_ONBOARDING_DISMISS_KEY);
  const dismissedAt = dismissedAtRaw ? Number(dismissedAtRaw) : 0;
  if (!dismissedAt || Number.isNaN(dismissedAt)) return true;
  return Date.now() - dismissedAt > CAPTAIN_ONBOARDING_DISMISS_MS;
}

export function CaptainFloatingPrompt() {
  const { authenticated, ready } = usePrivy();
  const authFetch = useAuthFetch();

  // Ensure we only render on client after hydration
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: impersonationData } = useQuery({
    queryKey: ["dev-impersonation"],
    queryFn: async () => {
      const res = await fetch("/api/dev/impersonate");
      if (!res.ok) return { active: false };
      return res.json() as Promise<{ active: boolean }>;
    },
    enabled: isDev && mounted,
    staleTime: 10_000,
  });

  const isImpersonating = isDev && impersonationData?.active;
  const hasSession = authenticated || isImpersonating;
  const canFetchAuthData = (ready && authenticated) || isImpersonating;

  const { data: captainData, isLoading: captainLoading } = useQuery({
    queryKey: ["my-captain"],
    queryFn: async () => {
      const res = await authFetch("/api/me/captain");
      if (!res.ok) return { captain: null };
      return res.json() as Promise<{ captain: unknown | null }>;
    },
    enabled: canFetchAuthData && mounted,
    staleTime: 30_000,
  });

  const hasCaptain = Boolean(captainData && captainData.captain);

  const [dismissed, setDismissed] = useState(true);
  useEffect(() => {
    if (!mounted) return;
    if (!hasSession) {
      setDismissed(true);
      return;
    }
    setDismissed(!shouldShowPromptFromLocalStorage());
  }, [mounted, hasSession]);

  // Don't render anything until mounted (avoids SSR hydration mismatch)
  if (!mounted) return null;

  // Don't render if user dismissed, still loading, has a captain, or not logged in
  if (!hasSession || dismissed || captainLoading || hasCaptain) return null;

  // In dev, place above the DevTools bubble (which is at bottom-6 right-6)
  // In production, place at bottom-6 right-6
  const positionClass = isDev ? "bottom-24 right-6" : "bottom-6 right-6";

  return (
    <div className={cn("hidden md:block fixed z-[9998]", positionClass)}>
      <CaptainSelector
        enabled={canFetchAuthData}
        mode="floating"
        autoPrompt={false}
        triggerLabel="Choose a Captain"
        triggerIconOnly
        dialogClassName="max-w-lg md:max-w-xl"
        triggerClassName={cn(
          "h-12 w-12 rounded-full border-2 border-[#df2421]/40",
          "bg-[#df2421] hover:bg-[#bf1f1c] text-white",
          "hover:scale-110 active:scale-95 transition-all duration-200",
          "shadow-[0_0_20px_6px_rgba(223,36,33,0.5)] hover:shadow-[0_0_25px_8px_rgba(223,36,33,0.6)]"
        )}
        onDismiss={() => setDismissed(true)}
      />
    </div>
  );
}
