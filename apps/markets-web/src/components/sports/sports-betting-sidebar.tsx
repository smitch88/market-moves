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

  // Determine if this is a CPMM market (shares-based)
  const isCPMM = selectedMarket?.pricingModel === "CPMM";

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
    enabled: isCPMM && !!selectedMarket && selectedOutcome !== null && amountNum > 0,
    staleTime: 5000, // Refresh every 5 seconds
  });

  // Fetch user position for sell mode
  const { data: position } = useQuery({
    queryKey: ["position", selectedMarket?.id],
    queryFn: async () => {
      if (!selectedMarket) return null;
      const res = await fetch(`/api/me/positions?marketId=${selectedMarket.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: isCPMM && authenticated && !!selectedMarket,
  });

  const userShares = useMemo(() => {
    if (!position || selectedOutcome === null) return 0;
    return selectedOutcome === 0 ? (position.shares0 || 0) : (position.shares1 || 0);
  }, [position, selectedOutcome]);

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
      // Amount is now stored in dollars (Decimal), convert to number for display
      const displayAmount = typeof pendingBet.amount === 'number' 
        ? pendingBet.amount 
        : parseFloat(String(pendingBet.amount));
      setAmount(String(displayAmount));
      setStep("verify");
    }
  }, [pendingBetData, betId, step, isCPMM]);

  // Place bet/trade mutation
  const placeBetMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMarket) throw new Error("No market selected");
      
      // Use different endpoints for CPMM vs pari-mutuel
      const endpoint = isCPMM ? "/api/trades/buy" : "/api/bets";
      const amountToSend = parseInt(amount, 10); // Amount in dollars
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: selectedMarket.id,
          outcomeIndex: selectedOutcome,
          amount: amountToSend,
          ...(isCPMM && { maxSlippage: 0.25 }), // 25% max slippage for CPMM trades
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
      queryClient.invalidateQueries({ queryKey: ["quote"] });
      toast.info(isCPMM 
        ? `Order for ~${quote?.outputAmount?.toFixed(2) || "?"} shares reserved! Share on X to confirm.`
        : "Bet reserved! Share on X to confirm."
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to place bet");
    },
  });
  
  // Sell shares mutation (CPMM only, no tweet required)
  const sellSharesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMarket || !isCPMM) throw new Error("Invalid market");
      const res = await fetch("/api/trades/sell", {
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
      toast.success(`Sold ${sharesNum.toFixed(2)} shares for $${proceedsNum.toFixed(2)}`);
      setAmount("");
      setTradeMode("buy");
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
    if (!amount || parseFloat(amount) <= 0) return;
    
    if (isCPMM && tradeMode === "sell") {
      sellSharesMutation.mutate();
    } else {
      placeBetMutation.mutate();
    }
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

  const amountNumLocal = parseInt(amount, 10) || 0;
  
  // Calculate display values based on pricing model
  const sharesDisplay = isCPMM && quote ? quote.outputAmount?.toFixed(2) : null;
  const potentialWin = isCPMM 
    ? (quote?.outputAmount ? Math.floor(quote.outputAmount) : 0) // 1 share = $1 at settlement
    : (selectedPrice > 0 ? Math.floor((amountNumLocal / selectedPrice) * 100) : 0);
  const priceImpactDisplay = quote?.priceImpact ? (quote.priceImpact * 100).toFixed(2) : null;

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
                {/* Buy/Sell toggle for CPMM markets */}
                {isCPMM && userShares > 0 && (
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
                  
                  {/* Show position for CPMM markets */}
                  {isCPMM && userShares > 0 && (
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
                    {isCPMM ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Est. return</span>
                          <span className="font-bold text-outcome-yes">~${potentialWin.toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Final payout based on pool at settlement
                        </p>
                      </>
                    )}
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
                      {isCPMM ? (
                        tradeMode === "sell" 
                          ? `Sell ${amount || 0} shares`
                          : `Buy ~${sharesDisplay || "?"} shares`
                      ) : (
                        `Bet on ${selectedOutcome !== null ? outcomes[selectedOutcome] : ""}`
                      )}
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
