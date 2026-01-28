"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import { ChevronRight, Wallet, Sparkles, X, TrendingUp, TrendingDown } from "lucide-react";
import {
  Button,
  Input,
  toast,
} from "@vault/ui";
import type { Market, Event } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { SuccessModal } from "../markets/betting-panel/success-modal";

interface SportsBettingSidebarProps {
  event: Event;
  selectedMarket: Market | null;
  selectedOutcome: number | null;
  onClearSelection: () => void;
}

// Parse outcomes from JSON
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

export function SportsBettingSidebar({
  event,
  selectedMarket,
  selectedOutcome,
  onClearSelection,
}: SportsBettingSidebarProps) {
  const { login, authenticated } = usePrivy();
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState("");
  const [betId, setBetId] = useState<string | null>(null);
  const [tweetUrl, setTweetUrl] = useState("");
  const [step, setStep] = useState<"bet" | "verify">("bet");

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmedBetAmount, setConfirmedBetAmount] = useState(0);
  const [confirmedOutcome, setConfirmedOutcome] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Price change tracking
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [priceChangeDirection, setPriceChangeDirection] = useState<"up" | "down" | null>(null);

  // Track price changes for flash animation
  const currentPrice = useMemo(() => {
    if (!selectedMarket || selectedOutcome === null) return null;
    const outcomePrices = parseOutcomePrices(selectedMarket.outcomePrices);
    return Math.round(parseFloat(outcomePrices[selectedOutcome] || "0.50") * 100);
  }, [selectedMarket?.outcomePrices, selectedOutcome]);

  // Detect price changes
  useEffect(() => {
    if (currentPrice !== null && previousPrice !== null && currentPrice !== previousPrice) {
      setPriceChangeDirection(currentPrice > previousPrice ? "up" : "down");
      // Reset after animation
      const timeout = setTimeout(() => setPriceChangeDirection(null), 2000);
      return () => clearTimeout(timeout);
    }
    setPreviousPrice(currentPrice);
  }, [currentPrice, previousPrice]);

  // Reset state when selection changes
  useEffect(() => {
    setAmount("");
    setBetId(null);
    setTweetUrl("");
    setStep("bet");
    setPreviousPrice(null);
    setPriceChangeDirection(null);
  }, [selectedMarket?.id, selectedOutcome]);

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await fetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: authenticated,
  });

  const balance = profile?.balance ?? 10000;

  // Check for pending bets
  const { data: pendingBetData } = useQuery({
    queryKey: ["pendingBet", selectedMarket?.id],
    queryFn: async () => {
      if (!selectedMarket) return null;
      const res = await fetch(`/api/bets/pending?marketId=${selectedMarket.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: authenticated && !!selectedMarket,
  });

  // Initialize pending bet if found
  useEffect(() => {
    if (pendingBetData?.pendingBet && !betId && step === "bet") {
      const pendingBet = pendingBetData.pendingBet;
      setBetId(pendingBet.id);
      setAmount(String(pendingBet.amount));
      setStep("verify");
    }
  }, [pendingBetData, betId, step]);

  // Place bet mutation
  const placeBetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMarket) throw new Error("No market selected");
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          outcomeIndex: selectedOutcome,
          amount: parseInt(amount, 10),
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
      queryClient.invalidateQueries({ queryKey: ["pendingBet", selectedMarket?.id] });
      toast.info("Bet reserved! Share on X to confirm.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to place bet");
    },
  });

  // Tweet intent mutation
  const tweetIntentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMarket) throw new Error("No market selected");
      const res = await fetch("/api/tweet/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: selectedMarket.id,
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
      toast.error(error.message || "Failed to create tweet.");
    },
  });

  // Verify tweet mutation
  const verifyTweetMutation = useMutation({
    mutationFn: async (method: "timeline" | "url") => {
      if (!selectedMarket) throw new Error("No market selected");
      const res = await fetch("/api/tweet/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: selectedMarket.id,
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
        setConfirmedBetAmount(parseInt(amount, 10));
        setConfirmedOutcome(selectedOutcome);
        setShowSuccessModal(true);

        setBetId(null);
        setStep("bet");
        setAmount("");
        setTweetUrl("");

        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile"] }),
          queryClient.refetchQueries({ queryKey: ["market", event.slug] }),
          queryClient.refetchQueries({ queryKey: ["pendingBet", selectedMarket?.id] }),
        ]);
      } else {
        toast.warning(data.message || "Tweet verification failed. Please try again.");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to verify tweet.");
    },
  });

  // Handlers
  const handlePlaceBet = () => {
    if (!authenticated) {
      login();
      return;
    }
    if (!amount || parseInt(amount, 10) <= 0) return;
    placeBetMutation.mutate();
  };

  const handleOpenTweetIntent = () => {
    if (!betId) return;
    tweetIntentMutation.mutate();
  };

  const handleVerify = (method: "timeline" | "url") => {
    verifyTweetMutation.mutate(method);
  };

  const generateTicketImage = useCallback(async (): Promise<string | null> => {
    if (!ticketRef.current) return null;
    try {
      return await toPng(ticketRef.current, {
        quality: 1.0,
        pixelRatio: 2,
        backgroundColor: "#0a0a0f",
      });
    } catch {
      return null;
    }
  }, []);

  const handleDownloadTicket = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = `vault-bet-${event.slug}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("Ticket downloaded!");
      }
    } catch {
      toast.error("Failed to download ticket");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [generateTicketImage, event.slug]);

  const handleShareTicketOnX = useCallback(async () => {
    if (!selectedMarket || confirmedOutcome === null) return;
    const outcomes = parseOutcomes(selectedMarket.outcomes);
    const outcomeLabel = outcomes[confirmedOutcome];

    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

        setTimeout(() => {
          const tweetText = encodeURIComponent(
            `🎯 I just bet $${confirmedBetAmount.toLocaleString()} on "${outcomeLabel}" for "${event.title}" on @VaultMarkets!\n\nMake your prediction 👇\n${window.location.href}`
          );
          window.open(`https://x.com/intent/tweet?text=${tweetText}`, "_blank");
        }, 500);

        toast.success("Ticket copied! Paste it in your tweet.", { duration: 4000 });
      }
    } catch {
      toast.error("Failed to copy ticket");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [generateTicketImage, event, confirmedBetAmount, confirmedOutcome, selectedMarket]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // If no market selected, show placeholder
  if (!selectedMarket) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-6"
      >
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-4">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Place Your Bet</h3>
          <p className="text-sm text-muted-foreground max-w-[200px]">
            Select an outcome from any market to get started
          </p>
        </div>
      </motion.div>
    );
  }

  const outcomes = parseOutcomes(selectedMarket.outcomes);
  const outcomePrices = parseOutcomePrices(selectedMarket.outcomePrices);
  const selectedPrice = selectedOutcome !== null
    ? Math.round(parseFloat(outcomePrices[selectedOutcome] || "0.50") * 100)
    : 50;

  const canBet =
    selectedMarket.status === "OPEN" ||
    (selectedMarket.status === "PUBLISHED" && (!selectedMarket.closesAt || new Date(selectedMarket.closesAt) > new Date()));

  const amountNum = parseInt(amount, 10) || 0;
  const potentialWin = selectedPrice > 0 ? Math.floor((amountNum / selectedPrice) * 100) : 0;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card/80 backdrop-blur-md border border-border/40 rounded-2xl overflow-hidden"
      >
        {/* Header with selected market */}
        <div className="p-4 border-b border-border/40">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground mb-1 truncate">
                {selectedMarket.question}
              </p>
              {selectedOutcome !== null && (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg">
                    {outcomes[selectedOutcome]}
                  </span>
                  <span 
                    className={cn(
                      "text-sm transition-colors duration-300",
                      priceChangeDirection === "up" && "text-green-500",
                      priceChangeDirection === "down" && "text-red-500",
                      !priceChangeDirection && "text-muted-foreground"
                    )}
                  >
                    {selectedPrice}%
                    {priceChangeDirection === "up" && (
                      <TrendingUp className="inline-block h-3 w-3 ml-1" />
                    )}
                    {priceChangeDirection === "down" && (
                      <TrendingDown className="inline-block h-3 w-3 ml-1" />
                    )}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={onClearSelection}
              className="w-7 h-7 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <AnimatePresence mode="wait">
            {step === "bet" ? (
              <motion.div
                key="bet"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {/* Balance display */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className="h-4 w-4" />
                    <span>Balance</span>
                  </div>
                  <span className="font-bold text-primary">${balance.toLocaleString()}</span>
                </div>

                {/* Amount input */}
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-light text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className="text-right text-2xl font-bold h-14 pr-4 pl-10 bg-muted/30 border-border/50"
                    min={1}
                    max={balance}
                  />
                </div>

                {/* Quick amount buttons */}
                <div className="grid grid-cols-4 gap-2">
                  {[1, 10, 50, 100].map((val) => (
                    <button
                      key={val}
                      onClick={() => setAmount((prev) => String((parseInt(prev, 10) || 0) + val))}
                      className="py-2 text-sm font-medium bg-muted/40 hover:bg-muted rounded-lg transition-colors"
                    >
                      +${val}
                    </button>
                  ))}
                </div>

                {/* Estimated return */}
                {amountNum > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="py-3 px-4 bg-outcome-yes/10 rounded-xl border border-outcome-yes/20"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Est. return</span>
                      <span className="font-bold text-outcome-yes">~${potentialWin.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Final payout based on pool at settlement
                    </p>
                  </motion.div>
                )}

                {/* Place bet button */}
                <Button
                  onClick={handlePlaceBet}
                  disabled={!canBet || !amount || amountNum <= 0 || placeBetMutation.isPending}
                  className="w-full h-12 text-base font-semibold"
                  size="lg"
                >
                  {placeBetMutation.isPending ? (
                    "Placing..."
                  ) : (
                    <span className="flex items-center gap-2">
                      Bet on {selectedOutcome !== null && outcomes[selectedOutcome]}
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  )}
                </Button>

                {/* Terms */}
                <p className="text-xs text-center text-muted-foreground">
                  By trading, you agree to the{" "}
                  <Link href="/terms" className="text-primary hover:underline">
                    Terms of Use
                  </Link>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="verify"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-4"
              >
                {/* Verification step */}
                <div className="text-center py-2">
                  <p className="text-sm text-muted-foreground mb-1">
                    Share on X to confirm your bet
                  </p>
                  <p className="font-semibold text-lg">
                    ${amount} on {selectedOutcome !== null && outcomes[selectedOutcome]}
                  </p>
                </div>

                <Button onClick={handleOpenTweetIntent} className="w-full" size="lg">
                  Share on X
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/50" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-3 text-muted-foreground">or paste URL</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={tweetUrl}
                    onChange={(e) => setTweetUrl(e.target.value)}
                    placeholder="https://x.com/..."
                    className="flex-1 text-sm"
                  />
                  <Button
                    onClick={() => handleVerify("url")}
                    disabled={!tweetUrl || verifyTweetMutation.isPending}
                    variant="secondary"
                    size="sm"
                  >
                    Verify
                  </Button>
                </div>

                <Button
                  onClick={() => handleVerify("timeline")}
                  variant="outline"
                  className="w-full"
                  disabled={verifyTweetMutation.isPending}
                >
                  {verifyTweetMutation.isPending ? "Verifying..." : "Auto-detect from timeline"}
                </Button>

                <button
                  onClick={() => {
                    setStep("bet");
                    setBetId(null);
                  }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Go back
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Success Modal */}
      {selectedMarket && (
        <SuccessModal
          open={showSuccessModal}
          onOpenChange={setShowSuccessModal}
          market={selectedMarket}
          event={event}
          outcomes={outcomes}
          confirmedOutcome={confirmedOutcome}
          confirmedBetAmount={confirmedBetAmount}
          profile={profile}
          ticketRef={ticketRef}
          isGeneratingImage={isGeneratingImage}
          copied={copied}
          onShareOnX={handleShareTicketOnX}
          onDownload={handleDownloadTicket}
          onCopyLink={handleCopyLink}
        />
      )}
    </>
  );
}
