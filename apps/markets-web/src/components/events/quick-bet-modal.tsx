"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  Button,
  Input,
  Label,
  toast,
} from "@vault/ui";
import { Loader2, ChevronLeft, ChevronRight, Check, Copy, Download } from "lucide-react";
import { toPng } from "html-to-image";
import { cn } from "@vault/ui/lib/utils";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { BettingTicket } from "@/components/markets/betting-ticket";
import { XIcon } from "@/components/markets/x-icon";
import { useXPAnimation } from "@/components/layout/xp-animation";
import { useQuickBetSize, BET_SIZE_OPTIONS } from "@/hooks/use-quick-bet-size";

interface QuickBetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventTitle: string;
  /** Optional: Pre-select a market to skip market selection step */
  initialMarket?: MarketData | null;
  /** Optional: Pre-select an outcome (0 or 1) to skip to amount step */
  initialOutcome?: number | null;
}

export interface MarketData {
  id: string;
  question: string;
  outcomes: string;
  status: string;
  closesAt: string | null;
  stats: {
    percent0: number;
    percent1: number;
    totalPool: number;
  };
}

interface EventMarketsResponse {
  event: {
    id: string;
    title: string;
    slug: string;
    bannerUrl: string | null;
    logoUrl: string | null;
    category: string;
  };
  markets: MarketData[];
}

type BettingStep = "market" | "outcome" | "amount" | "success";

// Helper to parse outcomes from JSON
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

export function QuickBetModal({
  open,
  onOpenChange,
  eventId,
  eventTitle,
  initialMarket = null,
  initialOutcome = null,
}: QuickBetModalProps) {
  const { authenticated, login, user } = usePrivy();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const { flushQueue, queueXPGain, queueBalanceChange } = useXPAnimation();
  
  const hasTwitter = !!user?.twitter;

  // Determine initial step based on props
  const getInitialStep = useCallback((): BettingStep => {
    if (initialMarket && initialOutcome !== null) return "amount";
    if (initialMarket) return "outcome";
    return "market";
  }, [initialMarket, initialOutcome]);

  // State
  const [step, setStep] = useState<BettingStep>(getInitialStep);
  const [selectedMarket, setSelectedMarket] = useState<MarketData | null>(initialMarket);
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(initialOutcome);
  const [amount, setAmount] = useState("");
  const [betId, setBetId] = useState<string | null>(null);
  const [confirmedBetAmount, setConfirmedBetAmount] = useState(0);
  const [confirmedOutcome, setConfirmedOutcome] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);
  
  // Quick bet size preference (synced across all modals via custom hook)
  const { quickBetSize, setQuickBetSize, isCustomAmount } = useQuickBetSize();
  const [showBetSizeSelector, setShowBetSizeSelector] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customAmountInput, setCustomAmountInput] = useState("");
  const customInputRef = useRef<HTMLInputElement>(null);
  
  // Focus custom input when switching to custom mode
  useEffect(() => {
    if (showCustomInput && showBetSizeSelector && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [showCustomInput, showBetSizeSelector]);
  
  // Save bet size (synced across all modals via hook)
  const handleBetSizeChange = (size: number) => {
    setQuickBetSize(size);
    setShowBetSizeSelector(false);
    setShowCustomInput(false);
  };
  
  const handleCustomAmountSubmit = () => {
    const num = parseInt(customAmountInput, 10);
    if (num > 0) {
      handleBetSizeChange(num);
    }
  };
  
  // Share for XP state
  const [xpClaimed, setXpClaimed] = useState(false);
  const [claimedXPAmount, setClaimedXPAmount] = useState(0);
  const [tweetUrl, setTweetUrl] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  
  // Track if we started with initial values (affects back button behavior)
  const hasInitialMarket = initialMarket !== null;
  const hasInitialOutcome = initialOutcome !== null;

  // Sync state when modal opens with new initial values
  useEffect(() => {
    if (open) {
      setStep(getInitialStep());
      setSelectedMarket(initialMarket);
      setSelectedOutcome(initialOutcome);
      setAmount("");
      setBetId(null);
      setConfirmedBetAmount(0);
      setConfirmedOutcome(null);
      setCopied(false);
      setXpClaimed(false);
      setClaimedXPAmount(0);
      setTweetUrl("");
      setShowManualEntry(false);
      setShowBetSizeSelector(false);
      setShowCustomInput(false);
      // Sync custom input with current quick bet size if it's custom
      if (isCustomAmount) {
        setCustomAmountInput(String(quickBetSize));
      }
    }
  }, [open, initialMarket, initialOutcome, getInitialStep, isCustomAmount, quickBetSize]);

  // Fetch event markets
  const { data, isLoading, error } = useQuery<EventMarketsResponse>({
    queryKey: ["eventMarkets", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/markets`);
      if (!res.ok) throw new Error("Failed to fetch markets");
      return res.json();
    },
    enabled: open,
  });

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

  // Fetch share XP config
  const { data: shareConfig } = useQuery({
    queryKey: ["shareXPConfig"],
    queryFn: async () => {
      const res = await fetch("/api/xp/share-config");
      if (!res.ok) return { shareBonusPercent: 20, xpPerDollar: 10 };
      return res.json();
    },
    enabled: open,
    staleTime: 60000, // Cache for 1 minute
  });

  const shareBonusPercent = shareConfig?.shareBonusPercent ?? 20;
  const xpPerDollar = shareConfig?.xpPerDollar ?? 10;
  const balance = profile?.balance ?? 10000;
  const markets = data?.markets || [];
  const event = data?.event;
  
  // Auto-select market if only one, or use initial market
  const effectiveMarket = selectedMarket || initialMarket || (markets.length === 1 ? markets[0] : null);
  const outcomes = effectiveMarket ? parseOutcomes(effectiveMarket.outcomes) : [];

  // Place bet mutation - accepts market, outcome, and amount as parameters for immediate betting
  const placeBetMutation = useMutation({
    mutationFn: async (params: { market: MarketData; outcomeIndex: number; betAmount: number }) => {
      const res = await authFetch("/api/trades/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: params.market.id,
          outcomeIndex: params.outcomeIndex,
          amount: params.betAmount,
          maxSlippage: 0.25, // 25% max slippage
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to place bet");
      }
      const data = await res.json();
      return { ...data, ...params };
    },
    onSuccess: async (data) => {
      const { betAmount, outcomeIndex, market } = data;
      setBetId(data.bet.id);
      setSelectedMarket(market);
      setSelectedOutcome(outcomeIndex);
      setConfirmedBetAmount(betAmount);
      setConfirmedOutcome(outcomeIndex);
      setStep("success");

      // Queue animations for when modal closes
      // Balance goes down (negative) when placing a bet
      queueBalanceChange(-betAmount);
      // XP is earned from the bet (returned from API)
      if (data.xpAwarded && data.xpAwarded > 0) {
        queueXPGain(data.xpAwarded);
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.invalidateQueries({ queryKey: ["eventMarkets", eventId] }),
        queryClient.invalidateQueries({ queryKey: ["xp"] }),
      ]);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to place bet");
    },
  });

  // Share for XP mutation
  const shareXPMutation = useMutation({
    mutationFn: async (method: "timeline" | "url") => {
      if (!betId) throw new Error("No bet ID");
      const res = await fetch(`/api/bets/${betId}/share-xp`, {
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
        // Queue XP animation with actual awarded amount from API
        const xpAwarded = data.xpAwarded || 0;
        if (xpAwarded > 0) {
          queueXPGain(xpAwarded);
        }
        
        setXpClaimed(true);
        setClaimedXPAmount(xpAwarded);
        toast.success(`+${xpAwarded.toLocaleString()} MP earned for sharing!`);
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
        toast.info("MP already claimed for this bet!");
      } else if (error.message.includes("already been used")) {
        toast.warning("This tweet was already used for MP. Please share a new tweet!");
      } else {
        // Show manual entry on error
        setShowManualEntry(true);
        toast.error(error.message || "Failed to verify share");
      }
    },
  });

  // Handle modal open/close
  const handleOpenChange = useCallback((newOpen: boolean) => {
    if (!newOpen) {
      // Flush XP animations when closing
      setTimeout(() => {
        flushQueue();
      }, 150);
    }
    onOpenChange(newOpen);
  }, [onOpenChange, flushQueue]);

  // Handlers - clicking Yes/No now places the bet immediately
  const handleSelectMarketAndOutcome = (market: MarketData, outcomeIndex: number) => {
    // Require authentication before placing bet
    if (!authenticated) {
      login();
      return;
    }
    // Place bet immediately with the selected quick bet size
    const betAmount = Math.min(quickBetSize, balance);
    if (betAmount <= 0) {
      toast.error("Insufficient balance");
      return;
    }
    placeBetMutation.mutate({ market, outcomeIndex, betAmount });
  };

  const handleSelectOutcome = (index: number) => {
    // Require authentication before placing bet
    if (!authenticated) {
      login();
      return;
    }
    if (!effectiveMarket) return;
    // Place bet immediately with the selected quick bet size
    const betAmount = Math.min(quickBetSize, balance);
    if (betAmount <= 0) {
      toast.error("Insufficient balance");
      return;
    }
    placeBetMutation.mutate({ market: effectiveMarket, outcomeIndex: index, betAmount });
  };

  const handlePlaceBet = () => {
    // Guard against unauthenticated users
    if (!authenticated) {
      login();
      return;
    }
    if (!selectedMarket || selectedOutcome === null) return;
    if (!amount || parseInt(amount, 10) <= 0) return;
    placeBetMutation.mutate({ 
      market: selectedMarket, 
      outcomeIndex: selectedOutcome, 
      betAmount: parseInt(amount, 10) 
    });
  };

  const handleBack = () => {
    if (step === "outcome") {
      // If we started with an initial market, close the modal instead of going back
      if (hasInitialMarket || markets.length === 1) {
        handleOpenChange(false);
      } else {
        setStep("market");
        setSelectedMarket(null);
      }
    } else if (step === "amount") {
      // If we started with an initial outcome, close the modal instead of going back
      if (hasInitialOutcome) {
        handleOpenChange(false);
      } else {
        setStep("outcome");
        setSelectedOutcome(null);
        setAmount("");
      }
    }
  };

  // Ticket generation
  const generateTicketImage = useCallback(async (): Promise<string | null> => {
    if (!ticketRef.current) return null;
    try {
      const dataUrl = await toPng(ticketRef.current, {
        quality: 1.0,
        pixelRatio: 2,
      });
      return dataUrl;
    } catch (error) {
      console.error("Failed to generate ticket image:", error);
      return null;
    }
  }, []);

  const handleDownloadTicket = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = `vault-bet-${event?.slug || eventId}-${Date.now()}.png`;
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
  }, [generateTicketImage, event?.slug, eventId]);

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
            `🎯 I just bet $${confirmedBetAmount.toLocaleString()} on "${outcomeLabel}" for "${eventTitle}" on @UseVault777!\n\nMake your prediction 👇\n${window.location.origin}/m/${event?.slug || eventId}`
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
  }, [generateTicketImage, selectedMarket, confirmedOutcome, confirmedBetAmount, eventTitle, event?.slug, eventId]);

  const handleCopyBetLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/m/${event?.slug || eventId}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  // If only one market or initial market provided, skip market selection step
  const showMarketStep = step === "market" && markets.length > 1 && !initialMarket;
  const actualStep = step === "market" && (markets.length === 1 || initialMarket) ? "outcome" : step;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-[100vw] sm:max-w-lg w-full h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] left-0 top-0 sm:left-[50%] sm:top-[50%] translate-x-0 translate-y-0 sm:translate-x-[-50%] sm:translate-y-[-50%] p-0 overflow-hidden rounded-none sm:rounded-lg">
        <div className="p-4 sm:p-6 space-y-4 h-full overflow-y-auto pb-safe">
          {/* Header */}
          <div className="flex items-center gap-3">
            {(actualStep === "outcome" || actualStep === "amount") && (
              <button
                onClick={handleBack}
                className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold">Quick Bet</h2>
              <p className="text-sm text-muted-foreground line-clamp-1">{eventTitle}</p>
            </div>
            {actualStep !== "success" && (
              <div className="relative flex-shrink-0 mr-6">
                {/* Custom bet size selector */}
                <button
                  onClick={() => setShowBetSizeSelector(!showBetSizeSelector)}
                  className="h-8 px-3 rounded-lg bg-muted border border-border text-sm font-semibold cursor-pointer hover:bg-accent transition-colors flex items-center gap-1.5"
                >
                  <span>${quickBetSize}</span>
                  <ChevronRight className={cn(
                    "h-3.5 w-3.5 transition-transform",
                    showBetSizeSelector && "rotate-90"
                  )} />
                </button>
                
                {/* Dropdown */}
                {showBetSizeSelector && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowBetSizeSelector(false)} 
                    />
                    <div className="absolute right-0 top-full mt-1 z-20 bg-card border border-border rounded-xl shadow-lg overflow-hidden min-w-[140px]">
                      {/* Preset options */}
                      {BET_SIZE_OPTIONS.map((size) => (
                        <button
                          key={size}
                          onClick={() => handleBetSizeChange(size)}
                          className={cn(
                            "w-full px-4 py-2.5 text-sm font-medium text-left hover:bg-muted transition-colors flex items-center justify-between",
                            quickBetSize === size && !isCustomAmount && "bg-primary/10 text-primary"
                          )}
                        >
                          <span>${size}</span>
                          {quickBetSize === size && !isCustomAmount && (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                      ))}
                      
                      {/* Divider */}
                      <div className="border-t border-border" />
                      
                      {/* Custom option */}
                      {showCustomInput || isCustomAmount ? (
                        <div className="px-3 py-2">
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-medium">$</span>
                            <input
                              ref={customInputRef}
                              type="number"
                              value={customAmountInput}
                              onChange={(e) => setCustomAmountInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleCustomAmountSubmit();
                                }
                              }}
                              onBlur={() => {
                                if (customAmountInput && parseInt(customAmountInput, 10) > 0) {
                                  handleCustomAmountSubmit();
                                }
                              }}
                              placeholder="Amount"
                              className="h-8 px-2 rounded-lg bg-muted border border-border text-sm font-semibold w-24"
                              min={1}
                            />
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setShowCustomInput(true);
                            setCustomAmountInput("");
                          }}
                          className="w-full px-4 py-2.5 text-sm font-medium text-left hover:bg-muted transition-colors text-muted-foreground"
                        >
                          Custom...
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Failed to load markets</p>
              <Button variant="outline" className="mt-3" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          ) : markets.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No markets available for betting</p>
              <Button variant="outline" className="mt-3" onClick={() => handleOpenChange(false)}>
                Close
              </Button>
            </div>
          ) : showMarketStep ? (
            // Market Selection Step - with inline outcome buttons
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {authenticated ? "Tap to bet:" : "Sign in to bet:"}
                </p>
                {authenticated && (
                  <p className="text-xs text-muted-foreground">
                    Balance: <span className="text-[#22C55E] font-medium">${balance.toLocaleString()}</span>
                  </p>
                )}
              </div>
              <div className="space-y-3 max-h-[60vh] sm:max-h-[50vh] overflow-y-auto -mx-1 px-1">
                {markets.map((market) => {
                  const marketOutcomes = parseOutcomes(market.outcomes);
                  return (
                    <div
                      key={market.id}
                      className="p-4 rounded-xl border border-border bg-card"
                    >
                      <p className="font-medium text-sm mb-3">
                        {market.question}
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSelectMarketAndOutcome(market, 0)}
                          disabled={placeBetMutation.isPending}
                          className="flex-1 h-14 rounded-lg font-medium text-sm transition-all duration-200 flex flex-col items-center justify-center bg-outcome-yes/[0.08] border border-outcome-yes/30 text-outcome-yes hover:bg-outcome-yes/[0.15] hover:border-outcome-yes/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {placeBetMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <span className="flex items-center gap-1.5">
                                {marketOutcomes[0]}
                                <span className="text-outcome-yes/60">{market.stats.percent0}%</span>
                              </span>
                              <span className="text-xs font-semibold mt-0.5">
                                ${Math.min(quickBetSize, balance)}
                              </span>
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleSelectMarketAndOutcome(market, 1)}
                          disabled={placeBetMutation.isPending}
                          className="flex-1 h-14 rounded-lg font-medium text-sm transition-all duration-200 flex flex-col items-center justify-center bg-outcome-no/[0.08] border border-outcome-no/30 text-outcome-no hover:bg-outcome-no/[0.15] hover:border-outcome-no/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {placeBetMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <span className="flex items-center gap-1.5">
                                {marketOutcomes[1]}
                                <span className="text-outcome-no/60">{market.stats.percent1}%</span>
                              </span>
                              <span className="text-xs font-semibold mt-0.5">
                                ${Math.min(quickBetSize, balance)}
                              </span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : actualStep === "outcome" && effectiveMarket ? (
            // Single market - Outcome Selection Step
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border bg-card">
                <p className="font-medium text-sm mb-3">
                  {effectiveMarket.question}
                </p>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-muted-foreground">
                    {authenticated ? "Tap to bet:" : "Sign in to bet:"}
                  </p>
                  {authenticated && (
                    <p className="text-xs text-muted-foreground">
                      Balance: <span className="text-[#22C55E] font-medium">${balance.toLocaleString()}</span>
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSelectOutcome(0)}
                    disabled={placeBetMutation.isPending}
                    className="flex-1 h-16 rounded-lg font-semibold text-sm transition-all duration-200 flex flex-col items-center justify-center bg-outcome-yes/[0.08] border border-outcome-yes/30 text-outcome-yes hover:bg-outcome-yes/[0.15] hover:border-outcome-yes/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {placeBetMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5">
                          {outcomes[0]}
                          <span className="text-outcome-yes/60 font-medium">{effectiveMarket.stats.percent0}%</span>
                        </span>
                        <span className="text-xs font-semibold mt-0.5">
                          ${Math.min(quickBetSize, balance)}
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleSelectOutcome(1)}
                    disabled={placeBetMutation.isPending}
                    className="flex-1 h-16 rounded-lg font-semibold text-sm transition-all duration-200 flex flex-col items-center justify-center bg-outcome-no/[0.08] border border-outcome-no/30 text-outcome-no hover:bg-outcome-no/[0.15] hover:border-outcome-no/50 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {placeBetMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span className="flex items-center gap-1.5">
                          {outcomes[1]}
                          <span className="text-outcome-no/60 font-medium">{effectiveMarket.stats.percent1}%</span>
                        </span>
                        <span className="text-xs font-semibold mt-0.5">
                          ${Math.min(quickBetSize, balance)}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : actualStep === "amount" && effectiveMarket && selectedOutcome !== null ? (
            // Amount Step
            <div className="space-y-4">
              <div className="text-center py-2 px-4 rounded-lg bg-muted/30 border border-border">
                <div className="text-xs text-muted-foreground mb-1">Your Pick</div>
                <div className={cn(
                  "text-sm font-semibold",
                  selectedOutcome === 0 ? "text-outcome-yes" : "text-outcome-no"
                )}>
                  {outcomes[selectedOutcome]}
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-sm">Bet Amount</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={balance}
                  min={1}
                  className="h-12 text-lg text-center font-semibold"
                  autoFocus
                />
                <div className="grid grid-cols-4 gap-2">
                  {[50, 100, 200, balance].map((preset) => {
                    const isSelected = amount === String(Math.min(preset, balance));
                    return (
                      <button
                        key={preset}
                        onClick={() => setAmount(String(Math.min(preset, balance)))}
                        className={cn(
                          "h-10 rounded-lg text-xs font-medium transition-all duration-200",
                          isSelected
                            ? "bg-primary text-primary-foreground border border-primary"
                            : "bg-muted border border-border text-foreground/70 hover:bg-accent hover:text-foreground"
                        )}
                      >
                        {preset === balance ? "Max" : `$${preset.toLocaleString()}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleBack}
                  className="flex-1 h-11 rounded-xl bg-muted border border-border text-foreground hover:bg-accent transition-all duration-200 font-medium active:scale-[0.98]"
                >
                  Back
                </button>
                <button
                  onClick={handlePlaceBet}
                  disabled={!amount || parseInt(amount, 10) > balance || placeBetMutation.isPending}
                  className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {placeBetMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    "Place Bet"
                  )}
                </button>
              </div>
            </div>
          ) : actualStep === "success" && effectiveMarket && confirmedOutcome !== null ? (
            // Success Step
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-xl font-bold">Bet Confirmed!</h3>
              </div>

              {/* Ticket Preview */}
              <div className="flex justify-center">
                <BettingTicket
                  ref={ticketRef}
                  market={effectiveMarket as any}
                  event={event as any}
                  outcomeLabel={outcomes[confirmedOutcome]}
                  outcomeIndex={confirmedOutcome}
                  amount={confirmedBetAmount}
                  userName={profile?.name}
                  userHandle={profile?.handle}
                  userAvatar={profile?.profileImageUrl}
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleShareTicketOnX}
                  disabled={isGeneratingImage}
                  className="flex-1 gap-2 bg-black hover:bg-black/80 text-white"
                >
                  {isGeneratingImage ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XIcon className="h-4 w-4" />
                  )}
                  Share on X
                </Button>
                <Button onClick={handleDownloadTicket} disabled={isGeneratingImage} variant="outline" className="gap-2">
                  {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                </Button>
                <Button onClick={handleCopyBetLink} variant="outline" className="gap-2">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              {/* Claim XP Section */}
              {betId && !xpClaimed && (
                <div className="space-y-2 pt-2 border-t border-border/50">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs sm:text-sm font-medium">Claim +{shareBonusPercent}% MP bonus for sharing</span>
                    {hasTwitter && (
                      <Button
                        onClick={() => shareXPMutation.mutate("timeline")}
                        disabled={shareXPMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="gap-2 w-full sm:w-auto"
                      >
                        {shareXPMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Check className="h-3 w-3" />
                        )}
                        Verify Post
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
                        className="flex-1 h-8 text-xs sm:text-sm"
                      />
                      <Button
                        onClick={() => shareXPMutation.mutate("url")}
                        disabled={!tweetUrl || shareXPMutation.isPending}
                        variant="secondary"
                        size="sm"
                      >
                        Verify
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* XP Claimed Success */}
              {xpClaimed && (
                <div className="flex items-center justify-center gap-2 text-green-500 pt-2 border-t border-border/50">
                  <Check className="h-4 w-4" />
                  <span className="text-sm font-medium">+{claimedXPAmount.toLocaleString()} MP Claimed!</span>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    // Reset to initial state for another bet
                    setStep(getInitialStep());
                    setSelectedMarket(initialMarket);
                    setSelectedOutcome(initialOutcome);
                    setBetId(null);
                    setConfirmedBetAmount(0);
                    setConfirmedOutcome(null);
                    setCopied(false);
                    setXpClaimed(false);
                    setClaimedXPAmount(0);
                    setTweetUrl("");
                    setShowManualEntry(false);
                  }} 
                  className="flex-1"
                >
                  Bet Again
                </Button>
                <Button onClick={() => handleOpenChange(false)} variant="ghost" className="flex-1 text-muted-foreground">
                  Done
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
