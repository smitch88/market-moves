"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toPng } from "html-to-image";
import { ChevronRight, Wallet, Sparkles, X, TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import {
  Button,
  Input,
  toast,
  Dialog,
  DialogContent,
} from "@vault/ui";
import type { Market, Event } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { SuccessModal } from "../markets/betting-panel/success-modal";
import { BettingTicket } from "../markets/betting-ticket";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { useXPAnimation } from "@/components/layout/xp-animation";

interface SportsBettingSidebarProps {
  event: Event;
  selectedMarket: Market | null;
  selectedOutcome: number | null;
  onClearSelection: () => void;
  /** Compact mode for mobile fixed bottom bar */
  compact?: boolean;
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
  compact = false,
}: SportsBettingSidebarProps) {
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
  
  // Dev-only: ticket preview modal
  const [showTicketPreview, setShowTicketPreview] = useState(false);

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
    setPreviousPrice(null);
    setPriceChangeDirection(null);
  }, [selectedMarket?.id, selectedOutcome]);

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
    queryKey: ["quote", selectedMarket?.id, selectedOutcome, amountNum, tradeMode],
    queryFn: async () => {
      if (!selectedMarket || selectedOutcome === null || amountNum <= 0) return null;
      const res = await fetch(
        `/api/trades/quote?marketId=${selectedMarket.id}&outcomeIndex=${selectedOutcome}&side=${tradeMode}&amount=${amountNum}`
      );
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedMarket && selectedOutcome !== null && amountNum > 0,
    staleTime: 5000, // Refresh every 5 seconds
  });

  // Fetch user position for sell mode
  const { data: position } = useQuery({
    queryKey: ["position", selectedMarket?.id],
    queryFn: async () => {
      if (!selectedMarket) return null;
      const res = await authFetch(`/api/me/positions?marketId=${selectedMarket.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: authenticated && !!selectedMarket,
  });

  const userShares = useMemo(() => {
    if (!position || selectedOutcome === null) return 0;
    return selectedOutcome === 0 ? (position.shares0 || 0) : (position.shares1 || 0);
  }, [position, selectedOutcome]);

  // Place bet/trade mutation - bet is confirmed immediately (no tweet required)
  const placeBetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMarket) throw new Error("No market selected");
      
      // Use CPMM trade endpoint
      const endpoint = "/api/trades/buy";
      const amountToSend = parseInt(amount, 10); // Amount in dollars
      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          outcomeIndex: selectedOutcome,
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
      const betAmount = parseInt(amount, 10);
      
      // Store bet ID for potential share-for-XP
      setBetId(data.bet.id);
      
      // Queue animations for when modal closes
      queueBalanceChange(-betAmount);
      if (data.xpAwarded && data.xpAwarded > 0) {
        queueXPGain(data.xpAwarded);
      }
      
      // Show success modal (no toast needed - modal is shown)
      setConfirmedBetAmount(betAmount);
      setConfirmedOutcome(selectedOutcome);
      setShowSuccessModal(true);
      
      // Reset form
      setAmount("");
      
      // Invalidate and refetch queries
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
  
  // Sell shares mutation (no tweet required)
  const sellSharesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMarket) throw new Error("Invalid market");
      const res = await authFetch("/api/trades/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          outcomeIndex: selectedOutcome,
          shares: parseFloat(amount), // For sell, amount is shares
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sell shares");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      const proceedsNum = typeof data.proceeds === 'number' 
        ? data.proceeds 
        : parseFloat(String(data.proceeds));
      const sharesNum = typeof data.shares === 'number' 
        ? data.shares 
        : parseFloat(String(data.shares));
      
      // Queue balance increase animation (selling adds to balance)
      queueBalanceChange(Math.round(proceedsNum));
      
      toast.success(`Sold ${sharesNum.toFixed(2)} shares for $${proceedsNum.toFixed(2)}`);
      setAmount("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["position", selectedMarket?.id] }),
        queryClient.refetchQueries({ queryKey: ["market", event.slug] }),
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to sell shares");
    },
  });

  // Handlers
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

  // If no market selected, show placeholder (not in compact mode)
  if (!selectedMarket) {
    if (compact) return null;
    return (
      <>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card/60 backdrop-blur-sm border border-border/40 rounded-2xl p-6"
        >
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <h3 className="font-semibold text-foreground mb-1">Place Your Bet</h3>
            <p className="text-sm text-muted-foreground max-w-[200px]">
              Select an outcome from any market to get started
            </p>
          </div>
        </motion.div>
        
      </>
    );
  }

  const outcomes = parseOutcomes(selectedMarket.outcomes);
  const outcomePrices = parseOutcomePrices(selectedMarket.outcomePrices);
  // Cap price at 1-99%
  const selectedPrice = selectedOutcome !== null
    ? Math.min(99, Math.max(1, Math.round(parseFloat(outcomePrices[selectedOutcome] || "0.50") * 100)))
    : 50;

  const canBet =
    selectedMarket.status === "OPEN" ||
    (selectedMarket.status === "PUBLISHED" && (!selectedMarket.closesAt || new Date(selectedMarket.closesAt) > new Date()));

  const amountNumLocal = parseInt(amount, 10) || 0;
  
  // Calculate display values
  const sharesDisplay = quote ? quote.outputAmount?.toFixed(2) : null;
  const potentialWin = quote?.outputAmount ? Math.floor(quote.outputAmount) : 0; // 1 share = $1 at settlement
  const priceImpactDisplay = quote?.priceImpact ? (quote.priceImpact * 100).toFixed(2) : null;

  // Compact mode for mobile bottom bar
  if (compact && selectedOutcome !== null) {
    return (
      <>
        <div className="space-y-3">
          {/* Top row: Selection info with close button */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-base">
                  {outcomes[selectedOutcome]}
                </span>
                <span className="text-sm font-medium text-primary">
                  {selectedPrice}%
                </span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">
                {selectedMarket.question}
              </p>
            </div>
            <button
              onClick={onClearSelection}
              className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors shrink-0"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          {/* Bottom row: Amount input and bet button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground">$</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-12 pl-8 pr-3 text-right text-lg font-bold bg-muted/30"
                min={1}
                max={balance}
              />
            </div>
            <Button
              onClick={handlePlaceBet}
              disabled={
                !canBet || 
                !amount || 
                parseFloat(amount) <= 0 || 
                placeBetMutation.isPending
              }
              className="h-12 px-6 text-base font-semibold"
            >
              {placeBetMutation.isPending ? "..." : "Place Bet"}
            </Button>
          </div>

          {/* Potential win display */}
          {amount && parseFloat(amount) > 0 && potentialWin > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Potential win</span>
              <span className="font-semibold text-green-500">${potentialWin.toLocaleString()}</span>
            </div>
          )}
        </div>

        {/* Success Modal - still needed for mobile */}
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
      </>
    );
  }

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
            {/* Show market closed state instead of betting UI */}
            {!canBet ? (
              <motion.div
                key="closed"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                <div className="text-center py-6">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                    {selectedMarket.status === "SETTLED" ? (
                      <span className="text-2xl">🏆</span>
                    ) : selectedMarket.status === "RESOLVED" ? (
                      <span className="text-2xl">✓</span>
                    ) : (
                      <span className="text-2xl">🔒</span>
                    )}
                  </div>
                  <h3 className="font-semibold text-lg mb-1">
                    {selectedMarket.status === "SETTLED" 
                      ? "Market Settled"
                      : selectedMarket.status === "RESOLVED"
                        ? "Market Resolved"
                        : selectedMarket.status === "CLOSED" || (selectedMarket.closesAt && new Date(selectedMarket.closesAt) < new Date())
                          ? "Market Closed"
                          : "Trading Unavailable"
                    }
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedMarket.status === "SETTLED" 
                      ? "This market has been settled. Check your positions for any payouts."
                      : selectedMarket.status === "RESOLVED"
                        ? `Outcome: ${(() => {
                            try {
                              const outcomes = JSON.parse(selectedMarket.outcomes);
                              return outcomes[selectedMarket.resolvedOutcome ?? 0] || "Unknown";
                            } catch {
                              return "Unknown";
                            }
                          })()}`
                        : selectedMarket.closesAt && new Date(selectedMarket.closesAt) < new Date()
                          ? "This market has closed for betting."
                          : "This market is not currently open for trading."
                    }
                  </p>
                  
                  {/* Show user's position if they have one */}
                  {userShares > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-xs text-muted-foreground mb-1">Your position</p>
                      <p className="font-bold text-lg">{userShares.toFixed(2)} shares</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedMarket.status === "SETTLED" 
                          ? "Redeem your winnings from your profile"
                          : "Awaiting market settlement"
                        }
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="bet"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {/* Buy/Sell toggle for markets */}
                {userShares > 0 && (
                  <div className="flex rounded-lg bg-muted/30 p-1">
                    <button
                      onClick={() => setTradeMode("buy")}
                      className={cn(
                        "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                        tradeMode === "buy" 
                          ? "bg-outcome-yes text-white" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Buy
                    </button>
                    <button
                      onClick={() => setTradeMode("sell")}
                      className={cn(
                        "flex-1 py-2 text-sm font-medium rounded-md transition-colors",
                        tradeMode === "sell" 
                          ? "bg-outcome-no text-white" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Sell
                    </button>
                  </div>
                )}

                {/* Balance and position display */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Wallet className="h-4 w-4" />
                      <span>Balance</span>
                    </div>
                    <span className="font-bold text-primary">${(balance).toLocaleString()}</span>
                  </div>
                  
                  {/* Show position for markets */}
                  {userShares > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ArrowUpDown className="h-4 w-4" />
                        <span>Your shares</span>
                      </div>
                      <span className="font-bold text-foreground">{userShares.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Amount input */}
                <div className="relative">
                  {tradeMode === "sell" ? (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
                      Shares
                    </span>
                  ) : (
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-light text-muted-foreground">
                      $
                    </span>
                  )}
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0"
                    className={cn(
                      "text-right text-2xl font-bold h-14 pr-4 bg-muted/30 border-border/50",
                      tradeMode === "sell" ? "pl-16" : "pl-10"
                    )}
                    min={tradeMode === "sell" ? 0.01 : 1}
                    max={tradeMode === "sell" ? userShares : balance}
                    step={tradeMode === "sell" ? "0.01" : "1"}
                  />
                </div>

                {/* Quick amount buttons - percentages for sell, dollars for buy */}
                <div className="grid grid-cols-4 gap-2">
                  {tradeMode === "sell" ? (
                    // Percentage buttons for selling shares
                    [25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        onClick={() => setAmount(String((userShares * pct / 100).toFixed(2)))}
                        className="py-2 text-sm font-medium bg-muted/40 hover:bg-muted rounded-lg transition-colors"
                      >
                        {pct}%
                      </button>
                    ))
                  ) : (
                    // Dollar buttons for buying
                    [50, 100, 200, balance].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setAmount(String(Math.min(preset, balance)))}
                        className={cn(
                          "py-2 text-sm font-medium rounded-lg transition-colors",
                          amount === String(Math.min(preset, balance))
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted/40 hover:bg-muted"
                        )}
                      >
                        {preset === balance ? "Max" : `$${preset}`}
                      </button>
                    ))
                  )}
                </div>

                {/* Estimated return / shares info */}
                {amountNumLocal > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className={cn(
                      "py-3 px-4 rounded-xl border",
                      tradeMode === "buy" 
                        ? "bg-outcome-yes/10 border-outcome-yes/20" 
                        : "bg-outcome-no/10 border-outcome-no/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {tradeMode === "buy" ? "You receive" : "You get"}
                      </span>
                      <span className={cn(
                        "font-bold",
                        tradeMode === "buy" ? "text-outcome-yes" : "text-outcome-no"
                      )}>
                        {tradeMode === "buy" 
                          ? `~${sharesDisplay || "?"} shares`
                          : `~$${quote?.outputAmount?.toFixed(2) || "?"}`
                        }
                      </span>
                    </div>
                    {tradeMode === "buy" && (
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm text-muted-foreground">Payout if correct</span>
                        <span className="font-bold text-outcome-yes">
                          ~${potentialWin.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {priceImpactDisplay && parseFloat(priceImpactDisplay) > 1 && (
                      <p className="text-xs text-amber-500 mt-1">
                        Price impact: {priceImpactDisplay}%
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
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
                    "w-full h-12 text-base font-semibold",
                    tradeMode === "sell" && "bg-outcome-no hover:bg-outcome-no/90"
                  )}
                  size="lg"
                >
                  {(placeBetMutation.isPending || sellSharesMutation.isPending) ? (
                    tradeMode === "sell" ? "Selling..." : "Placing..."
                  ) : (
                    <span className="flex items-center gap-2">
                      {tradeMode === "sell" 
                        ? `Sell ${amount || 0} shares`
                        : `Buy ~${sharesDisplay || "?"} shares`
                      }
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
