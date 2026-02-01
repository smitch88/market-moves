"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@vault/ui";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { X, HelpCircle, Trophy, Ticket } from "lucide-react";

// Custom event name for opening the welcome modal
export const OPEN_WELCOME_MODAL_EVENT = "open-welcome-modal";

// Helper function to open the welcome modal from anywhere
export function openWelcomeModal() {
  window.dispatchEvent(new CustomEvent(OPEN_WELCOME_MODAL_EVENT));
}

export function WelcomeModal() {
  const { authenticated, ready } = usePrivy();
  const authFetch = useAuthFetch();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  // Fetch user profile to check if they've seen the welcome modal
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await authFetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: authenticated && ready,
  });

  // Mark modal as seen
  const markSeenMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/me/welcome-modal", {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to update");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  // Listen for custom event to open modal
  useEffect(() => {
    const handleOpenModal = () => setOpen(true);
    window.addEventListener(OPEN_WELCOME_MODAL_EVENT, handleOpenModal);
    return () => window.removeEventListener(OPEN_WELCOME_MODAL_EVENT, handleOpenModal);
  }, []);

  // Show modal when profile loads and user hasn't seen it
  useEffect(() => {
    if (profile && !profile.hasSeenWelcomeModal && !isLoading) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [profile, isLoading]);

  const handleClose = () => {
    setOpen(false);
    // Only mark as seen if user hasn't seen it before
    if (profile && !profile.hasSeenWelcomeModal) {
      markSeenMutation.mutate();
    }
  };

  return (
    <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-black/50"
            onClick={handleClose}
          >
            {/* Mobile: Full screen | Desktop: Centered card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full h-full md:h-auto md:max-w-3xl bg-card md:border md:border-border md:rounded-2xl shadow-xl flex flex-col"
            >
              {/* Close button - visible on both mobile and desktop */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Hero image - taller on mobile */}
              <div className="relative h-48 sm:h-56 md:h-56 flex-shrink-0 overflow-hidden md:rounded-t-2xl">
                <Image
                  src="/vault777markets.png"
                  alt="Vault777 Markets - Predictions Are Coming"
                  fill
                  className="object-cover"
                  priority
                />
              </div>

              {/* Scrollable content area */}
              <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8 text-center">
                <h1 className="text-xl md:text-2xl font-semibold mb-3">
                  Welcome to Predictions by Vault777
                </h1>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4 max-w-xl mx-auto">
                  Think you can predict the future? Everyone starts with{" "}
                  <span className="text-foreground font-medium">$10,000</span> in virtual
                  credits. Make predictions on real-world events and compete to
                  see who has the best calls. Top predictors climb the leaderboard.
                </p>

                {/* Prize highlights */}
                <div className="flex flex-col sm:flex-row gap-3 mb-5 max-w-xl mx-auto">
                  <div className="flex-1 p-3 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <Trophy className="h-4 w-4 text-primary" />
                      <span className="text-sm font-semibold text-primary">$50,000</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      in stablecoins split across 100 winners
                    </p>
                  </div>
                  <div className="flex-1 p-3 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20">
                    <div className="flex items-center justify-center gap-2 mb-1.5">
                      <Ticket className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-semibold text-amber-500">Top Trader</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      wins 2x Super Bowl 2026 tickets + travel
                    </p>
                  </div>
                </div>

                <Link
                  href="/faq"
                  onClick={handleClose}
                  className="inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                  Learn more in our FAQ
                </Link>

                {/* Desktop-only button */}
                <div className="hidden md:block mt-6">
                  <Button onClick={handleClose} className="px-8">
                    Start Predicting
                  </Button>
                  <p className="text-[11px] text-muted-foreground mt-4">
                    All credits are virtual and for entertainment only
                  </p>
                </div>
              </div>

              {/* Mobile: Fixed bottom CTA */}
              <div className="md:hidden flex-shrink-0 p-4 border-t border-border bg-card/95 backdrop-blur-sm safe-area-bottom">
                <Button onClick={handleClose} className="w-full h-12 text-base font-semibold">
                  Start Predicting
                </Button>
                <p className="text-[10px] text-muted-foreground text-center mt-2">
                  All credits are virtual and for entertainment only
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
    </AnimatePresence>
  );
}
