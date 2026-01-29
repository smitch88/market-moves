"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@vault/ui";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { X } from "lucide-react";

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

  // Show modal when profile loads and user hasn't seen it
  useEffect(() => {
    if (profile && !profile.hasSeenWelcomeModal && !isLoading) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [profile, isLoading]);

  const handleClose = () => {
    setOpen(false);
    markSeenMutation.mutate();
  };

  if (!authenticated || !ready || !profile) {
    return null;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={handleClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-xl"
          >
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white/70 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Hero placeholder */}
            <div className="h-48 border-b border-border bg-muted/30 flex items-center justify-center rounded-t-2xl">
              <span className="text-sm text-muted-foreground">Hero image</span>
            </div>

            <div className="px-8 py-8 text-center">

              <h1 className="text-xl font-semibold mb-3">
                Welcome to Predictions by Vault777
              </h1>

              <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-lg mx-auto">
                Think you can predict the future? Everyone starts with{" "}
                <span className="text-foreground">$10,000</span> in virtual
                credits. Make predictions on real-world events and compete to
                see who has the best calls. Top predictors climb the leaderboard.
              </p>

              <Button onClick={handleClose} className="px-8">
                Start Predicting
              </Button>

              <p className="text-[11px] text-muted-foreground mt-4">
                All credits are virtual and for entertainment only
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
