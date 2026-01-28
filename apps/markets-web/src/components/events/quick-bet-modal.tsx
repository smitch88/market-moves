"use client";

import { useState, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  toast,
} from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import {
  Loader2,
  ChevronRight,
  ExternalLink,
  Check,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import type { Event } from "@vault/database";

interface QuickBetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  market: {
    id: string;
    question: string;
    outcomes: string;
    outcomePrices: string;
    outcomeColors: string | null;
  };
  selectedOutcomeIndex: number;
  onSuccess?: () => void;
}

function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

function parseOutcomePrices(outcomePrices: string): string[] {
  try {
    return JSON.parse(outcomePrices);
  } catch {
    return ["0.50", "0.50"];
  }
}

function parseOutcomeColors(outcomeColors: string | null): string[] {
  if (!outcomeColors) return ["#22C55E", "#EF4444"];
  try {
    return JSON.parse(outcomeColors);
  } catch {
    return ["#22C55E", "#EF4444"];
  }
}

const QUICK_AMOUNTS = [10, 50, 100, 500];

type BetStep = "amount" | "verify" | "success";

export function QuickBetModal({
  open,
  onOpenChange,
  event,
  market,
  selectedOutcomeIndex,
  onSuccess,
}: QuickBetModalProps) {
  const { login, authenticated } = usePrivy();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<BetStep>("amount");
  const [amount, setAmount] = useState("");
  const [betId, setBetId] = useState<string | null>(null);
  const [tweetUrl, setTweetUrl] = useState("");

  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const outcomeColors = parseOutcomeColors(market.outcomeColors);

  const selectedOutcome = outcomes[selectedOutcomeIndex] || "Yes";
  const selectedPrice = parseFloat(outcomePrices[selectedOutcomeIndex] || "0.50");
  const selectedPercent = Math.round(selectedPrice * 100);
  const selectedColor = outcomeColors[selectedOutcomeIndex] || "#22C55E";

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("amount");
      setAmount("");
      setBetId(null);
      setTweetUrl("");
    }
  }, [open]);

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: authenticated && open,
  });

  const balance = profile?.balance ?? 10000;
  const amountNum = parseInt(amount, 10) || 0;
  const estimatedPayout = selectedPrice > 0 ? Math.round(amountNum / selectedPrice) : 0;

  // Place bet mutation
  const placeBetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          outcomeIndex: selectedOutcomeIndex,
          amount: amountNum,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to place bet");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setBetId(data.bet.id);
      setStep("verify");
      toast.info("Bet reserved! Share your prediction on X to confirm.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to place bet");
    },
  });

  // Tweet intent mutation
  const tweetIntentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tweet/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          betId,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create tweet intent");
      }
      return res.json();
    },
    onSuccess: (data) => {
      window.open(data.intentUrl, "_blank", "width=550,height=420");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create tweet");
    },
  });

  // Verify tweet mutation
  const verifyTweetMutation = useMutation({
    mutationFn: async (method: "timeline" | "url") => {
      const res = await fetch("/api/tweet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          betId,
          method,
          tweetUrl: method === "url" ? tweetUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify tweet");
      }
      return data;
    },
    onSuccess: async (data) => {
      if (data.verified) {
        setStep("success");
        await queryClient.invalidateQueries({ queryKey: ["profile"] });
        onSuccess?.();
        // Close modal after short delay
        setTimeout(() => {
          onOpenChange(false);
        }, 2000);
      } else {
        toast.warning("Tweet not found. Make sure you posted the tweet and try again.");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to verify tweet");
    },
  });

  const handlePlaceBet = () => {
    if (!authenticated) {
      login();
      return;
    }
    if (amountNum <= 0 || amountNum > balance) return;
    placeBetMutation.mutate();
  };

  const handleOpenTweetIntent = () => {
    if (!betId) return;
    tweetIntentMutation.mutate();
  };

  const handleVerify = (method: "timeline" | "url") => {
    verifyTweetMutation.mutate(method);
  };

  const isLoading =
    placeBetMutation.isPending ||
    tweetIntentMutation.isPending ||
    verifyTweetMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border/50 bg-muted/20">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              {step === "success" ? "Bet Confirmed!" : `Bet on ${selectedOutcome}`}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">{event.title}</p>
        </div>

        <div className="p-4">
          <AnimatePresence mode="wait">
            {step === "amount" && (
              <motion.div
                key="amount"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-4"
              >
                {/* Selected outcome display */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: selectedColor }}
                    />
                    <span className="font-medium">{selectedOutcome}</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: selectedColor }}>
                    {selectedPercent}%
                  </span>
                </div>

                {/* Amount input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-7 pr-4 py-3 rounded-lg bg-background border border-border text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Balance: ${balance.toLocaleString()}</span>
                    {amountNum > balance && (
                      <span className="text-destructive">Insufficient balance</span>
                    )}
                  </div>
                </div>

                {/* Quick amounts */}
                <div className="flex gap-2">
                  {QUICK_AMOUNTS.map((quickAmount) => (
                    <button
                      key={quickAmount}
                      onClick={() => setAmount(String(quickAmount))}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-sm font-medium transition-colors",
                        amount === String(quickAmount)
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 hover:bg-muted"
                      )}
                    >
                      ${quickAmount}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmount(String(balance))}
                    className={cn(
                      "px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                      amount === String(balance)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 hover:bg-muted"
                    )}
                  >
                    Max
                  </button>
                </div>

                {/* Estimated payout */}
                {amountNum > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-3 rounded-lg bg-outcome-yes/10 border border-outcome-yes/20"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Est. return</span>
                      <span className="font-bold text-outcome-yes">~${estimatedPayout.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Final payout based on pool at settlement
                    </p>
                  </motion.div>
                )}

                {/* Place bet button */}
                <Button
                  onClick={handlePlaceBet}
                  disabled={amountNum <= 0 || amountNum > balance || isLoading}
                  className="w-full h-12 text-base font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : !authenticated ? (
                    "Sign in to bet"
                  ) : (
                    <>
                      Bet ${amountNum.toLocaleString()} on {selectedOutcome}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </motion.div>
            )}

            {step === "verify" && (
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div className="text-center p-4 rounded-lg bg-muted/30 border border-border/50">
                  <p className="font-medium mb-1">Share your prediction on X</p>
                  <p className="text-sm text-muted-foreground">
                    Post the tweet to confirm your ${amountNum} bet on {selectedOutcome}
                  </p>
                </div>

                <div className="space-y-3">
                  <Button
                    onClick={handleOpenTweetIntent}
                    disabled={isLoading}
                    className="w-full h-11"
                  >
                    {tweetIntentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <ExternalLink className="h-4 w-4 mr-2" />
                    )}
                    Open X to Post
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border/50" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-background px-2 text-muted-foreground">
                        Already posted?
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    onClick={() => handleVerify("timeline")}
                    disabled={isLoading}
                    className="w-full"
                  >
                    {verifyTweetMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Verify from my timeline
                  </Button>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={tweetUrl}
                      onChange={(e) => setTweetUrl(e.target.value)}
                      placeholder="Or paste tweet URL..."
                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <Button
                      variant="outline"
                      onClick={() => handleVerify("url")}
                      disabled={!tweetUrl || isLoading}
                    >
                      Verify
                    </Button>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  onClick={() => setStep("amount")}
                  className="w-full text-muted-foreground"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </motion.div>
            )}

            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="h-16 w-16 rounded-full bg-outcome-yes/20 flex items-center justify-center mx-auto"
                >
                  <Check className="h-8 w-8 text-outcome-yes" />
                </motion.div>
                <div>
                  <p className="text-lg font-bold">Bet Confirmed!</p>
                  <p className="text-muted-foreground">
                    ${amountNum.toLocaleString()} on {selectedOutcome}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
