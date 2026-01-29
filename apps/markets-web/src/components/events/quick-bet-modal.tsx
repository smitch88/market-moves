"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  toast,
} from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { getOutcomeColors } from "@/lib/outcome-colors";
import {
  Loader2,
  ChevronRight,
  Check,
  Download,
  Copy,
  Sparkles,
} from "lucide-react";
import { XIcon } from "../markets/x-icon";
import { BettingTicket } from "../markets/betting-ticket";
import type { Event, Market } from "@vault/database";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

interface QuickBetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: Event;
  market: {
    id: string;
    question: string;
    outcomes: string;
    outcomePrices: string;
    status?: string;
    closesAt?: string | null;
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

const QUICK_AMOUNTS = [10, 50, 100, 500];
const SHARE_XP_BONUS = 50;

type BetStep = "amount" | "success";

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
  const authFetch = useAuthFetch();

  const [step, setStep] = useState<BetStep>("amount");
  const [amount, setAmount] = useState("");
  const [betId, setBetId] = useState<string | null>(null);
  const [confirmedAmount, setConfirmedAmount] = useState(0);
  
  // Share state
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [xpClaimed, setXpClaimed] = useState(false);
  const [tweetUrl, setTweetUrl] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const { user } = usePrivy();
  const hasTwitter = !!user?.twitter;

  const outcomes = parseOutcomes(market.outcomes);
  const outcomePrices = parseOutcomePrices(market.outcomePrices);
  const outcomeColors = getOutcomeColors(outcomes);

  const selectedOutcome = outcomes[selectedOutcomeIndex] || "Yes";
  const selectedPrice = parseFloat(outcomePrices[selectedOutcomeIndex] || "0.50");
  const selectedPercent = Math.round(selectedPrice * 100);
  const selectedColor = outcomeColors[selectedOutcomeIndex] || outcomeColors[0];

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("amount");
      setAmount("");
      setBetId(null);
      setConfirmedAmount(0);
      setCopied(false);
      setXpClaimed(false);
      setTweetUrl("");
    }
  }, [open]);

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await authFetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: authenticated && open,
  });

  const balance = profile?.balance ?? 10000;
  const amountNum = parseInt(amount, 10) || 0;
  
  // Check if market is open for betting
  const canBet = 
    !market.status || // If no status provided, assume open
    market.status === "OPEN" ||
    (market.status === "PUBLISHED" && (!market.closesAt || new Date(market.closesAt) > new Date()));

  // Fetch quote for CPMM markets
  const { data: quote } = useQuery({
    queryKey: ["quickbet-quote", market.id, selectedOutcomeIndex, amountNum],
    queryFn: async () => {
      if (amountNum <= 0) return null;
      const res = await fetch(
        `/api/trades/quote?marketId=${market.id}&outcomeIndex=${selectedOutcomeIndex}&side=buy&amount=${amountNum}`
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: open && amountNum > 0,
    staleTime: 5000,
  });

  const sharesDisplay = quote ? quote.outputAmount?.toFixed(2) : null;
  const estimatedPayout = quote?.outputAmount ? Math.round(quote.outputAmount) : 0;

  // Place bet mutation - bet is confirmed immediately (no tweet required)
  const placeBetMutation = useMutation({
    mutationFn: async () => {
      // Use CPMM trade endpoint
      const endpoint = "/api/trades/buy";
      const amountToSend = amountNum;
      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          outcomeIndex: selectedOutcomeIndex,
          amount: amountToSend,
          maxSlippage: 0.25, // 25% max slippage
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to place bet");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      setBetId(data.bet.id);
      setConfirmedAmount(amountNum);
      setStep("success");
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      onSuccess?.();
      toast.success("Bet confirmed!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to place bet");
    },
  });

  // Share for XP mutation
  const shareXPMutation = useMutation({
    mutationFn: async (method: "timeline" | "url") => {
      if (!betId) throw new Error("No bet ID");
      const res = await authFetch(`/api/bets/${betId}/share-xp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          method,
          tweetUrl: method === "url" ? tweetUrl : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify share");
      }
      return data;
    },
    onSuccess: async (data) => {
      if (data.verified) {
        setXpClaimed(true);
        toast.success(`+${SHARE_XP_BONUS} XP earned for sharing!`);
        await queryClient.invalidateQueries({ queryKey: ["profile"] });
        await queryClient.invalidateQueries({ queryKey: ["xp"] });
      } else {
        // Auto-verify failed, show manual entry option
        setShowManualEntry(true);
        toast.warning(data.message || "Could not find your tweet. Try pasting the URL below.");
      }
    },
    onError: (error: Error) => {
      if (error.message.includes("already claimed")) {
        setXpClaimed(true);
        toast.info("XP already claimed for this bet!");
      } else if (error.message.includes("already been used")) {
        toast.warning("This tweet was already used for XP. Please share a new tweet!");
      } else {
        // Show manual entry on error
        setShowManualEntry(true);
        toast.error(error.message || "Failed to verify share");
      }
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

  const generateTicketImage = useCallback(async (): Promise<string | null> => {
    if (!ticketRef.current) return null;
    try {
      const dataUrl = await toPng(ticketRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#0a0a0f",
      });
      return dataUrl;
    } catch (error) {
      console.error("Failed to generate ticket image:", error);
      return null;
    }
  }, []);

  const handleShareOnX = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

        setTimeout(() => {
          const tweetText = encodeURIComponent(
            `🎯 I just bet $${confirmedAmount.toLocaleString()} on "${selectedOutcome}" for "${event.title}" on @VaultMarkets!\n\nMake your prediction 👇\n${window.location.origin}/markets/${event.slug}`
          );
          window.open(`https://x.com/intent/tweet?text=${tweetText}`, "_blank");
        }, 500);

        toast.success("Ticket copied to clipboard! Paste it in your tweet.", { duration: 4000 });
      }
    } catch (error) {
      console.error("Failed to copy ticket:", error);
      toast.error("Failed to copy ticket to clipboard");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [generateTicketImage, event.title, event.slug, confirmedAmount, selectedOutcome]);

  const handleDownload = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = `vault-bet-${event.slug}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("Ticket downloaded!");
      } else {
        toast.error("Failed to generate ticket");
      }
    } catch {
      toast.error("Failed to download ticket");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [generateTicketImage, event.slug]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/markets/${event.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const isLoading = placeBetMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md p-0 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {step === "success" ? "Bet Confirmed!" : `Bet on ${selectedOutcome}`}
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground mt-1">{event.title}</p>
        </div>

        <div className="p-4">
          <AnimatePresence mode="wait">
            {!canBet ? (
              <motion.div
                key="closed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-6"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                  {market.status === "SETTLED" ? (
                    <span className="text-2xl">🏆</span>
                  ) : market.status === "RESOLVED" ? (
                    <span className="text-2xl">✓</span>
                  ) : (
                    <span className="text-2xl">🔒</span>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-1">
                  {market.status === "SETTLED" 
                    ? "Market Settled"
                    : market.status === "RESOLVED"
                      ? "Market Resolved"
                      : "Trading Unavailable"
                  }
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {market.status === "SETTLED" 
                    ? "This market has been settled."
                    : market.status === "RESOLVED"
                      ? "The outcome has been determined."
                      : "This market is not open for trading."
                  }
                </p>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="w-full"
                >
                  Close
                </Button>
              </motion.div>
            ) : step === "amount" ? (
              <motion.div
                key="amount"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="space-y-3"
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
                      className="w-full pl-7 pr-3 py-2.5 rounded-lg bg-background border border-border text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Balance: ${(balance).toLocaleString()}</span>
                    {amountNum > balance && (
                      <span className="text-destructive">Insufficient balance</span>
                    )}
                  </div>
                </div>

                {/* Quick amounts */}
                <div className="flex gap-1.5">
                  {QUICK_AMOUNTS.map((quickAmount) => (
                    <button
                      key={quickAmount}
                      onClick={() => setAmount(String(quickAmount))}
                      className={cn(
                        "flex-1 py-1.5 rounded-md text-sm font-medium transition-colors",
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
                      "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                      amount === String(balance)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/50 hover:bg-muted"
                    )}
                  >
                    Max
                  </button>
                </div>

                {/* Estimated payout / shares info */}
                {amountNum > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="p-3 rounded-lg bg-outcome-yes/10 border border-outcome-yes/20"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">You receive</span>
                      <span className="font-bold text-outcome-yes">~{sharesDisplay || "?"} shares</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm text-muted-foreground">Payout if correct</span>
                      <span className="font-bold text-outcome-yes">~${estimatedPayout.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      1 winning share = $1 at settlement
                    </p>
                  </motion.div>
                )}

                {/* Place bet button */}
                <Button
                  onClick={handlePlaceBet}
                  disabled={amountNum <= 0 || amountNum > balance || isLoading}
                  className="w-full h-10 text-sm font-semibold"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : !authenticated ? (
                    "Sign in to bet"
                  ) : (
                    <>
                      {`Buy ~${sharesDisplay || "?"} shares`}
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </motion.div>
            ) : step === "success" ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                {/* Ticket Preview */}
                <div className="flex justify-center">
                  <BettingTicket
                    ref={ticketRef}
                    market={market as Market}
                    event={event}
                    outcomeLabel={selectedOutcome}
                    outcomeIndex={selectedOutcomeIndex}
                    amount={confirmedAmount}
                    userName={profile?.name}
                    userHandle={profile?.handle}
                    userAvatar={profile?.profileImageUrl}
                  />
                </div>

                {/* Share buttons */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">Share your betting ticket</p>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleShareOnX}
                      disabled={isGeneratingImage}
                      className="flex-1 gap-2 bg-black hover:bg-black/80 text-white"
                      size="sm"
                    >
                      {isGeneratingImage ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <XIcon className="h-3 w-3" />
                      )}
                      Share on X
                    </Button>
                    <Button onClick={handleDownload} disabled={isGeneratingImage} variant="outline" size="sm">
                      {isGeneratingImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    </Button>
                    <Button onClick={handleCopyLink} variant="outline" size="sm">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  </div>
                </div>

                {/* Claim XP Section */}
                {betId && !xpClaimed && (
                  <div className="space-y-2 pt-3 border-t border-border/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">Claim +{SHARE_XP_BONUS} XP for sharing on X</span>
                      </div>
                      {hasTwitter && (
                        <Button
                          onClick={() => shareXPMutation.mutate("timeline")}
                          disabled={shareXPMutation.isPending}
                          variant="outline"
                          size="sm"
                          className="gap-1 h-7 text-xs"
                        >
                          {shareXPMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Verify Tweet
                        </Button>
                      )}
                    </div>
                    {/* Manual URL entry: show always if no Twitter, or on auto-verify fail */}
                    {(!hasTwitter || showManualEntry) && (
                      <div className="flex gap-2">
                        <Input
                          type="url"
                          value={tweetUrl}
                          onChange={(e) => setTweetUrl(e.target.value)}
                          placeholder="Paste tweet URL..."
                          className="flex-1 h-7 text-xs"
                        />
                        <Button
                          onClick={() => shareXPMutation.mutate("url")}
                          disabled={!tweetUrl || shareXPMutation.isPending}
                          variant="secondary"
                          size="sm"
                          className="h-7 text-xs"
                        >
                          Verify
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* XP Claimed Success */}
                {xpClaimed && (
                  <div className="flex items-center justify-center gap-2 text-green-500 pt-3 border-t border-border/50">
                    <Check className="h-3 w-3" />
                    <span className="text-xs font-medium">+{SHARE_XP_BONUS} XP Claimed!</span>
                  </div>
                )}

                {/* Close button */}
                <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full text-muted-foreground" size="sm">
                  Continue Browsing
                </Button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
