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

const SHARE_XP_BONUS = 50;

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
  
  // Share for XP state
  const [xpClaimed, setXpClaimed] = useState(false);
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
      setTweetUrl("");
      setShowManualEntry(false);
    }
  }, [open, initialMarket, initialOutcome, getInitialStep]);

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

  const balance = profile?.balance ?? 10000;
  const markets = data?.markets || [];
  const event = data?.event;

  // Place bet mutation
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
      setBetId(data.bet.id);
      setConfirmedBetAmount(betAmount);
      setConfirmedOutcome(selectedOutcome);
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
        // Queue XP animation
        queueXPGain(SHARE_XP_BONUS);
        
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

  // Handlers
  const handleSelectMarket = (market: MarketData) => {
    setSelectedMarket(market);
    // If only one market, we came here from a direct click, go to outcome
    setStep("outcome");
  };

  const handleSelectOutcome = (index: number) => {
    // Require authentication before advancing to amount step
    if (!authenticated) {
      login();
      return;
    }
    setSelectedOutcome(index);
    setStep("amount");
  };

  const handlePlaceBet = () => {
    // Guard against unauthenticated users
    if (!authenticated) {
      login();
      return;
    }
    if (!amount || parseInt(amount, 10) <= 0) return;
    placeBetMutation.mutate();
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
        backgroundColor: "#000000",
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
            `🎯 I just bet $${confirmedBetAmount.toLocaleString()} on "${outcomeLabel}" for "${eventTitle}" on @VaultMarkets!\n\nMake your prediction 👇\n${window.location.origin}/m/${event?.slug || eventId}`
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

  // Auto-select market if only one, or use initial market
  const effectiveMarket = selectedMarket || initialMarket || (markets.length === 1 ? markets[0] : null);
  const outcomes = effectiveMarket ? parseOutcomes(effectiveMarket.outcomes) : [];

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
            {authenticated && actualStep !== "success" && (
              <div className="text-right flex-shrink-0">
                <p className="text-xs text-muted-foreground">Balance</p>
                <p className="text-sm font-semibold text-[#22C55E]">${balance.toLocaleString()}</p>
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
            // Market Selection Step
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Select a market:</p>
              <div className="space-y-2 max-h-[60vh] sm:max-h-[50vh] overflow-y-auto -mx-1 px-1">
                {markets.map((market) => {
                  const marketOutcomes = parseOutcomes(market.outcomes);
                  return (
                    <button
                      key={market.id}
                      onClick={() => handleSelectMarket(market)}
                      className="w-full p-4 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors text-left"
                    >
                      <p className="font-medium text-sm mb-3">
                        {market.question}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2.5 py-1.5 rounded-lg bg-outcome-yes/10 text-outcome-yes font-medium whitespace-nowrap">
                          {marketOutcomes[0]} {market.stats.percent0}%
                        </span>
                        <span className="px-2.5 py-1.5 rounded-lg bg-outcome-no/10 text-outcome-no font-medium whitespace-nowrap">
                          {marketOutcomes[1]} {market.stats.percent1}%
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : actualStep === "outcome" && effectiveMarket ? (
            // Outcome Selection Step
            <div className="space-y-4">
              <div className="text-center py-3 px-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm font-medium">
                  {effectiveMarket.question}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                {authenticated ? "Pick your prediction:" : "Sign in and pick your prediction:"}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => handleSelectOutcome(0)}
                  className="flex-1 h-16 rounded-xl font-semibold text-base transition-all duration-200 flex flex-col items-center justify-center gap-1 bg-outcome-yes/[0.08] border border-outcome-yes/30 text-outcome-yes hover:bg-outcome-yes/[0.15] hover:border-outcome-yes/50 active:scale-[0.98]"
                >
                  <span className="text-sm">{outcomes[0]}</span>
                  <span className="text-xs font-medium text-outcome-yes/70">
                    {effectiveMarket.stats.percent0}%
                  </span>
                </button>
                <button
                  onClick={() => handleSelectOutcome(1)}
                  className="flex-1 h-16 rounded-xl font-semibold text-base transition-all duration-200 flex flex-col items-center justify-center gap-1 bg-outcome-no/[0.08] border border-outcome-no/30 text-outcome-no hover:bg-outcome-no/[0.15] hover:border-outcome-no/50 active:scale-[0.98]"
                >
                  <span className="text-sm">{outcomes[1]}</span>
                  <span className="text-xs font-medium text-outcome-no/70">
                    {effectiveMarket.stats.percent1}%
                  </span>
                </button>
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
                  {[100, 500, 1000, balance].map((preset) => {
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
                    <span className="text-xs sm:text-sm font-medium">Claim +{SHARE_XP_BONUS} XP for sharing on X</span>
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
                  <span className="text-sm font-medium">+{SHARE_XP_BONUS} XP Claimed!</span>
                </div>
              )}

              {/* Close button */}
              <Button onClick={() => handleOpenChange(false)} variant="ghost" className="w-full text-muted-foreground">
                Continue Browsing
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
