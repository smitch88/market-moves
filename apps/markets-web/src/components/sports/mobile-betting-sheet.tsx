"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import {
  ChevronRight,
  X,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button, Input, toast } from "@vault/ui";
import type { Market, Event } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { SuccessModal } from "../markets/betting-panel/success-modal";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { useXPAnimation } from "@/components/layout/xp-animation";

interface MobileBettingSheetProps {
  event: Event;
  selectedMarket: Market | null;
  selectedOutcome: number | null;
  onClearSelection: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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

export function MobileBettingSheet({
  event,
  selectedMarket,
  selectedOutcome,
  onClearSelection,
  isOpen,
  onOpenChange,
}: MobileBettingSheetProps) {
  const { login, authenticated } = usePrivy();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const { queueXPGain, queueBalanceChange } = useXPAnimation();

  const [amount, setAmount] = useState("");
  const [betId, setBetId] = useState<string | null>(null);
  const [tradeMode, setTradeMode] = useState<"buy" | "sell">("buy");

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmedBetAmount, setConfirmedBetAmount] = useState(0);
  const [confirmedOutcome, setConfirmedOutcome] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Price change tracking
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [priceChangeDirection, setPriceChangeDirection] = useState<
    "up" | "down" | null
  >(null);

  // Track price changes for flash animation
  const currentPrice = useMemo(() => {
    if (!selectedMarket || selectedOutcome === null) return null;
    const outcomePrices = parseOutcomePrices(selectedMarket.outcomePrices);
    return Math.round(
      parseFloat(outcomePrices[selectedOutcome] || "0.50") * 100
    );
  }, [selectedMarket?.outcomePrices, selectedOutcome]);

  // Detect price changes
  useEffect(() => {
    if (
      currentPrice !== null &&
      previousPrice !== null &&
      currentPrice !== previousPrice
    ) {
      setPriceChangeDirection(currentPrice > previousPrice ? "up" : "down");
      const timeout = setTimeout(() => setPriceChangeDirection(null), 2000);
      return () => clearTimeout(timeout);
    }
    setPreviousPrice(currentPrice);
  }, [currentPrice, previousPrice]);

  // Reset state when selection changes
  useEffect(() => {
    setAmount("");
    setBetId(null);
    setPreviousPrice(null);
    setPriceChangeDirection(null);
    setTradeMode("buy");
  }, [selectedMarket?.id, selectedOutcome]);

  // Prevent body scroll when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Fetch user profile
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await authFetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
    enabled: authenticated,
  });

  const balance = profile?.balance ?? 10000;

  // Fetch quote for CPMM markets
  const amountNum = parseInt(amount, 10) || 0;
  const { data: quote } = useQuery({
    queryKey: [
      "quote",
      selectedMarket?.id,
      selectedOutcome,
      amountNum,
      tradeMode,
    ],
    queryFn: async () => {
      if (!selectedMarket || selectedOutcome === null || amountNum <= 0)
        return null;
      const res = await fetch(
        `/api/trades/quote?marketId=${selectedMarket.id}&outcomeIndex=${selectedOutcome}&side=${tradeMode}&amount=${amountNum}`
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedMarket && selectedOutcome !== null && amountNum > 0,
    staleTime: 5000,
  });

  // Fetch user position for sell mode
  const { data: position } = useQuery({
    queryKey: ["position", selectedMarket?.id],
    queryFn: async () => {
      if (!selectedMarket) return null;
      const res = await authFetch(
        `/api/me/positions?marketId=${selectedMarket.id}`
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: authenticated && !!selectedMarket,
  });

  const userShares = useMemo(() => {
    if (!position || selectedOutcome === null) return 0;
    return selectedOutcome === 0
      ? position.shares0 || 0
      : position.shares1 || 0;
  }, [position, selectedOutcome]);

  // Place bet/trade mutation
  const placeBetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMarket) throw new Error("No market selected");
      const res = await authFetch("/api/trades/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          outcomeIndex: selectedOutcome,
          amount: parseInt(amount, 10),
          maxSlippage: 0.25,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to place bet");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      const betAmount = parseInt(amount, 10);
      setBetId(data.bet.id);
      queueBalanceChange(-betAmount);
      if (data.xpAwarded && data.xpAwarded > 0) {
        queueXPGain(data.xpAwarded);
      }
      setConfirmedBetAmount(betAmount);
      setConfirmedOutcome(selectedOutcome);
      setShowSuccessModal(true);
      setAmount("");
      onOpenChange(false);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["quote"] }),
        queryClient.invalidateQueries({ queryKey: ["xp"] }),
        queryClient.refetchQueries({ queryKey: ["market", event.slug] }),
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to place bet");
    },
  });

  // Sell shares mutation
  const sellSharesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMarket) throw new Error("Invalid market");
      const res = await authFetch("/api/trades/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          outcomeIndex: selectedOutcome,
          shares: parseFloat(amount),
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sell shares");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      const proceedsNum =
        typeof data.proceeds === "number"
          ? data.proceeds
          : parseFloat(String(data.proceeds));
      const sharesNum =
        typeof data.shares === "number"
          ? data.shares
          : parseFloat(String(data.shares));
      queueBalanceChange(Math.round(proceedsNum));
      toast.success(
        `Sold ${sharesNum.toFixed(2)} shares for $${proceedsNum.toFixed(2)}`
      );
      setAmount("");
      onOpenChange(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({
          queryKey: ["position", selectedMarket?.id],
        }),
        queryClient.refetchQueries({ queryKey: ["market", event.slug] }),
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sell shares");
    },
  });

  const handlePlaceBet = () => {
    if (!authenticated) {
      login();
      return;
    }
    if (!amount || parseFloat(amount) <= 0) return;
    if (tradeMode === "sell") {
      sellSharesMutation.mutate();
    } else {
      placeBetMutation.mutate();
    }
  };

  const generateTicketImage = useCallback(async (): Promise<string | null> => {
    if (!ticketRef.current) return null;
    try {
      return await toPng(ticketRef.current, {
        quality: 1.0,
        pixelRatio: 2,
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
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setTimeout(() => {
          const tweetText = encodeURIComponent(
            `🎯 I just bet $${confirmedBetAmount.toLocaleString()} on "${outcomeLabel}" for "${event.title}" on @UseVault777!\n\nMake your prediction 👇\n${window.location.href}`
          );
          window.open(`https://x.com/intent/tweet?text=${tweetText}`, "_blank");
        }, 500);
        toast.success("Ticket copied! Paste it in your tweet.", {
          duration: 4000,
        });
      }
    } catch {
      toast.error("Failed to copy ticket");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [
    generateTicketImage,
    event,
    confirmedBetAmount,
    confirmedOutcome,
    selectedMarket,
  ]);

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

  const handleClose = () => {
    onOpenChange(false);
    onClearSelection();
  };

  if (!selectedMarket || selectedOutcome === null) return null;

  const outcomes = parseOutcomes(selectedMarket.outcomes);
  const outcomePrices = parseOutcomePrices(selectedMarket.outcomePrices);
  const selectedPrice =
    selectedOutcome !== null
      ? Math.min(
          99,
          Math.max(
            1,
            Math.round(
              parseFloat(outcomePrices[selectedOutcome] || "0.50") * 100
            )
          )
        )
      : 50;

  const canBet =
    selectedMarket.status === "OPEN" ||
    (selectedMarket.status === "PUBLISHED" &&
      (!selectedMarket.closesAt ||
        new Date(selectedMarket.closesAt) > new Date()));

  const sharesDisplay = quote ? quote.outputAmount?.toFixed(2) : null;
  const potentialWin = quote?.outputAmount ? Math.floor(quote.outputAmount) : 0;
  const priceImpactDisplay = quote?.priceImpact
    ? (quote.priceImpact * 100).toFixed(2)
    : null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
              onClick={() => onOpenChange(false)}
            />

            {/* Bottom Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[80] bg-background rounded-t-3xl max-h-[85dvh] overflow-hidden shadow-2xl"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 rounded-full bg-muted-foreground/30" />
              </div>

              {/* Content */}
              <div className="px-5 pb-safe overflow-y-auto max-h-[calc(85dvh-40px)]">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                      {selectedMarket.question}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xl">
                        {outcomes[selectedOutcome]}
                      </span>
                      <span
                        className={cn(
                          "text-base font-medium transition-colors duration-300",
                          priceChangeDirection === "up" && "text-green-500",
                          priceChangeDirection === "down" && "text-red-500",
                          !priceChangeDirection && "text-muted-foreground"
                        )}
                      >
                        {selectedPrice}%
                        {priceChangeDirection === "up" && (
                          <TrendingUp className="inline-block h-4 w-4 ml-1" />
                        )}
                        {priceChangeDirection === "down" && (
                          <TrendingDown className="inline-block h-4 w-4 ml-1" />
                        )}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
                  >
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>

                {!canBet ? (
                  /* Market closed state */
                  <div className="text-center py-8 pb-6">
                    {(selectedMarket.status === "SETTLED" || selectedMarket.status === "RESOLVED") && selectedMarket.resolvedOutcome !== null ? (
                      <>
                        <p className="text-sm text-muted-foreground mb-1">
                          {selectedMarket.status === "SETTLED" ? "Final result" : "Resolved to"}
                        </p>
                        <p className="font-bold text-xl text-green-500 mb-2">
                          {outcomes[selectedMarket.resolvedOutcome] || "Unknown"}
                        </p>
                        {selectedMarket.resolutionSourceUrl && (
                          <a href={selectedMarket.resolutionSourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary mb-4 inline-block">
                            Source ↗
                          </a>
                        )}
                      </>
                    ) : (
                      <>
                        <h3 className="font-semibold text-lg mb-1">Market Closed</h3>
                        <p className="text-sm text-muted-foreground mb-4">Awaiting resolution</p>
                      </>
                    )}
                    
                    {userShares > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Your position: <span className="font-semibold text-foreground">{userShares.toFixed(2)} shares</span>
                      </p>
                    )}
                  </div>
                ) : (
                  /* Betting UI */
                  <div className="space-y-4 pb-6">
                    {/* Buy/Sell toggle */}
                    {userShares > 0 && (
                      <div className="flex rounded-xl bg-muted/30 p-1">
                        <button
                          onClick={() => {
                            setTradeMode("buy");
                            setAmount("");
                          }}
                          className={cn(
                            "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all",
                            tradeMode === "buy"
                              ? "bg-outcome-yes text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Buy
                        </button>
                        <button
                          onClick={() => {
                            setTradeMode("sell");
                            setAmount("");
                          }}
                          className={cn(
                            "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all",
                            tradeMode === "sell"
                              ? "bg-outcome-no text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          Sell
                        </button>
                      </div>
                    )}

                    {/* Balance and position display */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Balance</span>
                      <span className="font-semibold text-primary">
                        ${balance.toLocaleString()}
                      </span>
                    </div>

                    {userShares > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Your shares</span>
                        <span className="font-semibold">
                          {userShares.toFixed(2)}
                        </span>
                      </div>
                    )}

                    {/* Amount input */}
                    <div className="relative">
                      {tradeMode === "sell" ? (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                          Shares
                        </span>
                      ) : (
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-3xl font-light text-muted-foreground">
                          $
                        </span>
                      )}
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                        className={cn(
                          "text-right text-3xl font-bold h-16 pr-4 bg-muted/30 border-border/50 rounded-xl",
                          tradeMode === "sell" ? "pl-20" : "pl-12"
                        )}
                        min={tradeMode === "sell" ? 0.01 : 1}
                        max={tradeMode === "sell" ? userShares : balance}
                        step={tradeMode === "sell" ? "0.01" : "1"}
                      />
                    </div>

                    {/* Quick amount buttons */}
                    <div className="grid grid-cols-4 gap-2">
                      {tradeMode === "sell"
                        ? [25, 50, 75, 100].map((pct) => (
                            <button
                              key={pct}
                              onClick={() =>
                                setAmount(
                                  String(
                                    ((userShares * pct) / 100).toFixed(2)
                                  )
                                )
                              }
                              className="py-3 text-sm font-semibold bg-muted/40 hover:bg-muted rounded-xl transition-colors"
                            >
                              {pct}%
                            </button>
                          ))
                        : [50, 100, 200, balance].map((preset) => (
                            <button
                              key={preset}
                              onClick={() =>
                                setAmount(String(Math.min(preset, balance)))
                              }
                              className={cn(
                                "py-3 text-sm font-semibold rounded-xl transition-colors",
                                amount === String(Math.min(preset, balance))
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted/40 hover:bg-muted"
                              )}
                            >
                              {preset === balance ? "Max" : `$${preset}`}
                            </button>
                          ))}
                    </div>

                    {/* Estimated return info */}
                    {amountNum > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className={cn(
                          "py-4 px-4 rounded-xl border",
                          tradeMode === "buy"
                            ? "bg-outcome-yes/10 border-outcome-yes/20"
                            : "bg-outcome-no/10 border-outcome-no/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">
                            {tradeMode === "buy" ? "You receive" : "You get"}
                          </span>
                          <span
                            className={cn(
                              "font-bold text-lg",
                              tradeMode === "buy"
                                ? "text-outcome-yes"
                                : "text-outcome-no"
                            )}
                          >
                            {tradeMode === "buy"
                              ? `~${sharesDisplay || "?"} shares`
                              : `~$${quote?.outputAmount?.toFixed(2) || "?"}`}
                          </span>
                        </div>
                        {tradeMode === "buy" && (
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm text-muted-foreground">
                              Payout if correct
                            </span>
                            <span className="font-bold text-lg text-outcome-yes">
                              ~${potentialWin.toLocaleString()}
                            </span>
                          </div>
                        )}
                        {priceImpactDisplay &&
                          parseFloat(priceImpactDisplay) > 1 && (
                            <p className="text-xs text-amber-500 mt-2">
                              Price impact: {priceImpactDisplay}%
                            </p>
                          )}
                        <p className="text-xs text-muted-foreground mt-2">
                          1 winning share = $1 at settlement
                        </p>
                      </motion.div>
                    )}

                    {/* Place bet/trade button */}
                    <Button
                      onClick={handlePlaceBet}
                      disabled={
                        !canBet ||
                        !amount ||
                        parseFloat(amount) <= 0 ||
                        placeBetMutation.isPending ||
                        sellSharesMutation.isPending ||
                        (tradeMode === "sell" && parseFloat(amount) > userShares)
                      }
                      className={cn(
                        "w-full h-14 text-lg font-semibold rounded-xl",
                        tradeMode === "sell" &&
                          "bg-outcome-no hover:bg-outcome-no/90"
                      )}
                      size="lg"
                    >
                      {placeBetMutation.isPending ||
                      sellSharesMutation.isPending ? (
                        tradeMode === "sell" ? (
                          "Selling..."
                        ) : (
                          "Placing..."
                        )
                      ) : (
                        <span className="flex items-center gap-2">
                          {tradeMode === "sell"
                            ? `Sell ${amount || 0} shares`
                            : `Buy ~${sharesDisplay || "?"} shares`}
                          <ChevronRight className="h-5 w-5" />
                        </span>
                      )}
                    </Button>

                    {/* Terms */}
                    <p className="text-xs text-center text-muted-foreground pb-2">
                      By trading, you agree to the{" "}
                      <Link
                        href="/terms"
                        className="text-primary hover:underline"
                      >
                        Terms of Use
                      </Link>
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
          betId={betId}
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

