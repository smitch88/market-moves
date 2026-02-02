"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { Button, Badge } from "@vault/ui";
import { ProfileCard } from "./profile-card";
import { SearchBar } from "./search-bar";
import { SearchModal } from "./search-modal";
import { Search, Bug, Gift } from "lucide-react";
import { DailySpinWheel } from "@/components/daily-spin";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { useState, Suspense, useEffect, useRef } from "react";
import { AnimatedXPDisplay, AnimatedBalanceDisplay, useXPAnimation } from "./xp-animation";
import { cn } from "@vault/ui/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const isDev = process.env.NODE_ENV === "development";

const navLinks = [
  { href: "/", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Header() {
  const pathname = usePathname();
  const { login, authenticated, ready } = usePrivy();
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [dailySpinOpen, setDailySpinOpen] = useState(false);
  const authFetch = useAuthFetch();

  // Only fetch impersonation state in dev mode
  const { data: impersonationData } = useQuery({
    queryKey: ["dev-impersonation"],
    queryFn: async () => {
      const res = await fetch("/api/dev/impersonate");
      if (!res.ok) return { active: false, user: null };
      return res.json();
    },
    enabled: isDev,
  });

  const isImpersonating = isDev && impersonationData?.active;
  // Only show ProfileCard if actually authenticated via Privy OR actively impersonating
  const hasSession = authenticated || isImpersonating;
  // Wait for Privy to be ready before making authenticated requests
  const canFetchAuthData = (ready && authenticated) || isImpersonating;

  // Fetch user profile for PnL
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await authFetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: canFetchAuthData,
    staleTime: 10000, // Consider data stale after 10 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: 3, // Retry failed requests (handles race with user provisioning)
    retryDelay: (attemptIndex) => Math.min(500 * 2 ** attemptIndex, 3000),
  });

  // Fetch XP with auto-refresh
  const { data: xpData, isLoading: xpLoading, dataUpdatedAt: xpUpdatedAt } = useQuery({
    queryKey: ["xp"],
    queryFn: async () => {
      const res = await authFetch("/api/me/xp");
      if (!res.ok) return { xp: 0 };
      return res.json();
    },
    enabled: canFetchAuthData,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000, // Consider data stale after 10 seconds
  });

  const xp = xpData?.xp ?? 0;
  const balance = profile?.balance ?? 0;

  // Fetch daily spin status
  const { data: spinStatus, refetch: refetchSpinStatus } = useQuery({
    queryKey: ["daily-spin-status"],
    queryFn: async () => {
      const res = await authFetch("/api/me/daily-spin");
      if (!res.ok) return { canSpin: false };
      return res.json();
    },
    enabled: canFetchAuthData,
    staleTime: 30000,
    refetchInterval: 60000, // Check every minute
  });

  const canSpin = spinStatus?.canSpin ?? false;
  // Only show daily spin button once we've loaded status AND feature is not disabled
  const dailySpinEnabled = spinStatus !== undefined && !spinStatus?.featureDisabled;

  // Refetch spin status and profile when modal closes
  const handleSpinModalClose = () => {
    setDailySpinOpen(false);
    refetchSpinStatus();
    refetchProfile(); // Triggers balance animation via useEffect
  };

  // Get reset functions from animation context
  const { resetBalanceOffset, resetXPOffset, markXPServerUpdated, markBalanceServerUpdated } = useXPAnimation();
  
  // Track previous values to reset optimistic offsets when actual data changes
  const prevXpRef = useRef<number | undefined>(undefined);
  const prevBalanceRef = useRef<number | undefined>(undefined);
  const initializedRef = useRef(false);
  
  // Reset offsets when actual data changes from server
  useEffect(() => {
    // Skip initialization
    if (!initializedRef.current) {
      if (balance !== undefined) {
        prevBalanceRef.current = balance;
      }
      if (xp !== undefined) {
        prevXpRef.current = xp;
        initializedRef.current = true;
      }
      return;
    }
    
    // If balance changed, reset balance offset and mark balance as updated
    // The AnimatedNumber will handle the animation from old to new value
    if (balance !== prevBalanceRef.current) {
      resetBalanceOffset();
      markBalanceServerUpdated();
      prevBalanceRef.current = balance;
    }
    
    // If XP changed, reset XP offset and mark XP as updated
    if (xp !== prevXpRef.current) {
      resetXPOffset();
      markXPServerUpdated();
      prevXpRef.current = xp;
    }
  }, [balance, xp, resetBalanceOffset, resetXPOffset, markXPServerUpdated, markBalanceServerUpdated]);
  // Show loading state while Privy is initializing or data is loading
  const isLoadingUserData = !canFetchAuthData || profileLoading || xpLoading;

  return (
    <>
    <motion.header
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-xl",
        isImpersonating ? "border-red-500/50" : "border-border/40"
      )}
    >
      <div className="max-w-7xl mx-auto flex h-16 items-center gap-2 xs:gap-4 sm:gap-6 px-3 xs:px-4 w-full">
        {/* Logo and Nav - Left side */}
        <div className="flex items-center gap-2 xs:gap-4 sm:gap-6 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <Image
                src="/logo.svg"
                alt="Vault Markets"
                width={40}
                height={28}
                className="h-6 xs:h-7 w-auto"
                priority
              />
            </motion.div>
            {isImpersonating && (
              <Badge variant="destructive" className="text-[10px] gap-1 animate-pulse hidden xs:flex">
                <Bug className="h-3 w-3" />
                Impersonating
              </Badge>
            )}
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link key={link.href} href={link.href}>
                  <motion.span
                    className={cn(
                      "px-3 py-2 text-sm font-medium rounded-lg transition-colors inline-block",
                      isActive
                        ? "text-foreground bg-muted"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                  >
                    {link.label}
                  </motion.span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Search Bar - Center (Desktop only) */}
        <div className="flex-1 flex justify-center max-w-xl mx-auto hidden md:flex">
          <Suspense fallback={<SearchBarSkeleton />}>
            <SearchBar />
          </Suspense>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-1.5 xs:gap-2 sm:gap-3 flex-shrink-0 ml-auto">
          {/* Mobile search button */}
          <motion.button
            className="md:hidden p-1.5 xs:p-2 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setSearchModalOpen(true)}
            aria-label="Search"
            whileTap={{ scale: 0.9 }}
          >
            <Search className="h-4 w-4 xs:h-5 xs:w-5 text-muted-foreground" />
          </motion.button>

          {/* Mobile daily spin button */}
          {hasSession && dailySpinEnabled && (
            <motion.button
              className="sm:hidden p-1 rounded-md hover:bg-muted/50 transition-colors relative"
              onClick={() => setDailySpinOpen(true)}
              aria-label="Daily Spin"
              whileTap={{ scale: 0.9 }}
            >
              <Gift className="h-4 w-4 text-foreground" />
              {canSpin && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
              )}
            </motion.button>
          )}

          {/* XP and Balance stats - shown when logged in */}
          {hasSession && (
            <div className="hidden sm:flex items-center gap-3 lg:gap-5 mr-1 lg:mr-2">
              <div className="flex flex-col items-center min-h-[44px]">
                <span className="text-[10px] lg:text-[11px] text-muted-foreground font-medium tracking-wide">MP</span>
                <AnimatedXPDisplay xp={xp} isLoading={isLoadingUserData} />
              </div>
              <div className="flex flex-col items-center min-h-[44px]">
                <span className="text-[10px] lg:text-[11px] text-muted-foreground font-medium tracking-wide">Balance</span>
                <AnimatedBalanceDisplay balance={balance} isLoading={isLoadingUserData} />
              </div>
              {dailySpinEnabled && (
                <motion.button
                  onClick={() => setDailySpinOpen(true)}
                  className="p-1 rounded-md hover:bg-muted/50 transition-colors relative"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label="Daily Spin"
                >
                  <Gift className="h-4 w-4 text-foreground" />
                  {canSpin && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
                  )}
                </motion.button>
              )}
            </div>
          )}

          {/* Show ProfileCard if authenticated via Privy OR actively impersonating */}
          <AnimatePresence mode="wait">
            {hasSession ? (
              <motion.div
                key="profile"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <ProfileCard />
              </motion.div>
            ) : (
              /* Show Sign In button when Privy is ready */
              ready && (
                <motion.div
                  key="signin"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button onClick={login} size="sm" className="font-medium">
                    Sign In
                  </Button>
                </motion.div>
              )
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Search Modal for Mobile */}
      <SearchModal open={searchModalOpen} onOpenChange={setSearchModalOpen} />
    </motion.header>

    {/* Daily Spin Modal - outside header for proper z-index */}
    {hasSession && (
      <DailySpinWheel 
        isOpen={dailySpinOpen} 
        onClose={handleSpinModalClose}
      />
    )}
    </>
  );
}

function SearchBarSkeleton() {
  return (
    <div className="w-full max-w-md h-10 rounded-lg bg-muted/50 dark:bg-white/[0.04] animate-pulse" />
  );
}
