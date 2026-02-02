"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { ChevronRight, ChevronDown, Wallet, X, TrendingUp, TrendingDown, ArrowUpDown, Crosshair } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Button,
  Input,
  toast,
} from "@vault/ui";
import type { Market, Event } from "@vault/database";
import { cn } from "@vault/ui/lib/utils";
import { SuccessModal } from "../markets/betting-panel/success-modal";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { useXPAnimation } from "@/components/layout/xp-animation";

interface SportsBettingSidebarProps {
  event: Event;
  selectedMarket: Market | null;
  selectedOutcome: number | null;
  onClearSelection: () => void;
  /** Compact mode for mobile fixed bottom bar */
  compact?: boolean;
  /** Controlled collapsed state */
  isCollapsed?: boolean;
  /** Callback when panel header is clicked */
  onToggle?: () => void;
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
  isCollapsed = false,
  onToggle,
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
            `🎯 I just bet $${confirmedBetAmount.toLocaleString()} on "${outcomeLabel}" for "${event.title}" on @UseVault777!\n\nMake your prediction 👇\n${window.location.href}`
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

  // Prepare values needed for rendering (even if no market selected)
  const outcomes = selectedMarket ? parseOutcomes(selectedMarket.outcomes) : [];
  const outcomePrices = selectedMarket ? parseOutcomePrices(selectedMarket.outcomePrices) : [];
  const selectedPrice = selectedOutcome !== null && selectedMarket
    ? Math.min(99, Math.max(1, Math.round(parseFloat(outcomePrices[selectedOutcome] || "0.50") * 100)))
    : 50;
  const canBet = selectedMarket && (
    selectedMarket.status === "OPEN" ||
    (selectedMarket.status === "PUBLISHED" && (!selectedMarket.closesAt || new Date(selectedMarket.closesAt) > new Date()))
  );
  const amountNumLocal = parseInt(amount, 10) || 0;
  const sharesDisplay = quote ? quote.outputAmount?.toFixed(2) : null;
  const potentialWin = quote?.outputAmount ? Math.floor(quote.outputAmount) : 0;
  const priceImpactDisplay = quote?.priceImpact ? (quote.priceImpact * 100).toFixed(2) : null;

  // Compact mode for mobile - return early
  if (compact) {
    if (!selectedMarket || selectedOutcome === null) return null;
    return (
      <>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-bold text-base">{outcomes[selectedOutcome]}</span>
                <span className="text-sm font-medium text-primary">{selectedPrice}%</span>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">{selectedMarket.question}</p>
            </div>
            <button onClick={onClearSelection} className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors shrink-0">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground">$</span>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className="h-12 pl-8 pr-3 text-right text-lg font-bold bg-muted/30" min={1} max={balance} />
            </div>
            <Button onClick={handlePlaceBet} disabled={!canBet || !amount || parseFloat(amount) <= 0 || placeBetMutation.isPending} className="h-12 px-6 text-base font-semibold">
              {placeBetMutation.isPending ? "..." : "Place Bet"}
            </Button>
          </div>
          {amount && parseFloat(amount) > 0 && potentialWin > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Potential win</span>
              <span className="font-semibold text-green-500">${potentialWin.toLocaleString()}</span>
            </div>
          )}
        </div>
        <SuccessModal open={showSuccessModal} onOpenChange={setShowSuccessModal} market={selectedMarket} event={event} outcomes={outcomes} confirmedOutcome={confirmedOutcome} confirmedBetAmount={confirmedBetAmount} betId={betId} profile={profile} ticketRef={ticketRef} isGeneratingImage={isGeneratingImage} copied={copied} onShareOnX={handleShareTicketOnX} onDownload={handleDownloadTicket} onCopyLink={handleCopyLink} />
      </>
    );
  }

  // Desktop view - define sidebar content as a variable
  const sidebarContent = (
    <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
      {/* Header - clickable to toggle */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 border-b border-border/50 flex items-center gap-2 hover:bg-muted/30 transition-colors"
      >
        <Crosshair className="h-4 w-4 text-primary" />
        <h3 className="font-semibold text-sm">
          {selectedMarket ? (
            <span className="flex items-center gap-2">
              <span className="truncate max-w-[200px]">{outcomes[selectedOutcome ?? 0]}</span>
              <span className={cn("text-xs transition-colors duration-300", priceChangeDirection === "up" && "text-green-500", priceChangeDirection === "down" && "text-red-500", !priceChangeDirection && "text-muted-foreground")}>
                {selectedPrice}%
              </span>
            </span>
          ) : (
            "Place Your Bet"
          )}
        </h3>
        <ChevronDown 
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200 ml-auto",
            isCollapsed && "-rotate-90"
          )} 
        />
      </button>

      {/* Content - collapsible */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
      {!selectedMarket ? (
        <div className="p-4">
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <p className="text-sm text-muted-foreground max-w-[200px]">
              Select an outcome from any market to get started
            </p>
          </div>
        </div>
      ) : (
        <div>
          <div className="px-4 pt-2 pb-1">
            <p className="text-xs text-muted-foreground truncate">{selectedMarket.question}</p>
          </div>
          <div className="p-4 pt-2 space-y-4">
            {!canBet ? (
              <div className="text-center py-6">
                {(selectedMarket.status === "SETTLED" || selectedMarket.status === "RESOLVED") && selectedMarket.resolvedOutcome !== null ? (
                  <>
                    <p className="text-sm text-muted-foreground mb-1">
                      {selectedMarket.status === "SETTLED" ? "Final result" : "Resolved to"}
                    </p>
                    <p className="font-bold text-lg text-green-500 mb-2">
                      {(() => { try { return JSON.parse(selectedMarket.outcomes)[selectedMarket.resolvedOutcome] || "Unknown"; } catch { return "Unknown"; } })()}
                    </p>
                    {selectedMarket.resolutionSourceUrl && (
                      <a href={selectedMarket.resolutionSourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-primary">
                        Source ↗
                      </a>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="font-semibold text-lg mb-1">
                      {selectedMarket.status === "CLOSED" || (selectedMarket.closesAt && new Date(selectedMarket.closesAt) < new Date()) ? "Market Closed" : "Trading Unavailable"}
                    </h3>
                    <p className="text-sm text-muted-foreground">Awaiting resolution</p>
                  </>
                )}
                
                {userShares > 0 && (
                  <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border/50">
                    <p className="text-xs text-muted-foreground mb-1">Your position</p>
                    <p className="font-bold text-lg">{userShares.toFixed(2)} shares</p>
                    <p className="text-xs text-muted-foreground">{selectedMarket.status === "SETTLED" ? "Redeem from profile" : "Awaiting settlement"}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {userShares > 0 && (
                  <div className="flex rounded-lg bg-muted/30 p-1">
                    <button onClick={() => setTradeMode("buy")} className={cn("flex-1 py-2 text-sm font-medium rounded-md transition-colors", tradeMode === "buy" ? "bg-outcome-yes text-white" : "text-muted-foreground hover:text-foreground")}>Buy</button>
                    <button onClick={() => setTradeMode("sell")} className={cn("flex-1 py-2 text-sm font-medium rounded-md transition-colors", tradeMode === "sell" ? "bg-outcome-no text-white" : "text-muted-foreground hover:text-foreground")}>Sell</button>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground"><Wallet className="h-4 w-4" /><span>Balance</span></div>
                    <span className="font-bold text-primary">${balance.toLocaleString()}</span>
                  </div>
                  {userShares > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground"><ArrowUpDown className="h-4 w-4" /><span>Your shares</span></div>
                      <span className="font-bold text-foreground">{userShares.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="relative">
                  {tradeMode === "sell" ? <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">Shares</span> : <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-light text-muted-foreground">$</span>}
                  <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" className={cn("text-right text-2xl font-bold h-14 pr-4 bg-muted/30 border-border/50", tradeMode === "sell" ? "pl-16" : "pl-10")} min={tradeMode === "sell" ? 0.01 : 1} max={tradeMode === "sell" ? userShares : balance} step={tradeMode === "sell" ? "0.01" : "1"} />
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {tradeMode === "sell" ? [25, 50, 75, 100].map((pct) => (<button key={pct} onClick={() => setAmount(String((userShares * pct / 100).toFixed(2)))} className="py-2 text-sm font-medium bg-muted/40 hover:bg-muted rounded-lg transition-colors">{pct}%</button>)) : [50, 100, 200, balance].map((preset) => (<button key={preset} onClick={() => setAmount(String(Math.min(preset, balance)))} className={cn("py-2 text-sm font-medium rounded-lg transition-colors", amount === String(Math.min(preset, balance)) ? "bg-primary text-primary-foreground" : "bg-muted/40 hover:bg-muted")}>{preset === balance ? "Max" : `$${preset}`}</button>))}
                </div>
                {amountNumLocal > 0 && (
                  <div className={cn("py-3 px-4 rounded-xl border", tradeMode === "buy" ? "bg-outcome-yes/10 border-outcome-yes/20" : "bg-outcome-no/10 border-outcome-no/20")}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{tradeMode === "buy" ? "You receive" : "You get"}</span>
                      <span className={cn("font-bold", tradeMode === "buy" ? "text-outcome-yes" : "text-outcome-no")}>{tradeMode === "buy" ? `~${sharesDisplay || "?"} shares` : `~$${quote?.outputAmount?.toFixed(2) || "?"}`}</span>
                    </div>
                    {tradeMode === "buy" && (<div className="flex items-center justify-between mt-1"><span className="text-sm text-muted-foreground">Payout if correct</span><span className="font-bold text-outcome-yes">~${potentialWin.toLocaleString()}</span></div>)}
                    {priceImpactDisplay && parseFloat(priceImpactDisplay) > 1 && <p className="text-xs text-amber-500 mt-1">Price impact: {priceImpactDisplay}%</p>}
                    <p className="text-xs text-muted-foreground mt-1">1 winning share = $1 at settlement</p>
                  </div>
                )}
                <Button onClick={handlePlaceBet} disabled={!canBet || !amount || parseFloat(amount) <= 0 || placeBetMutation.isPending || sellSharesMutation.isPending || (tradeMode === "sell" && parseFloat(amount) > userShares)} className={cn("w-full h-12 text-base font-semibold", tradeMode === "sell" && "bg-outcome-no hover:bg-outcome-no/90")} size="lg">
                  {(placeBetMutation.isPending || sellSharesMutation.isPending) ? (tradeMode === "sell" ? "Selling..." : "Placing...") : (<span className="flex items-center gap-2">{tradeMode === "sell" ? `Sell ${amount || 0} shares` : `Buy ~${sharesDisplay || "?"} shares`}<ChevronRight className="h-4 w-4" /></span>)}
                </Button>
                <p className="text-xs text-center text-muted-foreground">By trading, you agree to the <Link href="/terms" className="text-primary hover:underline">Terms of Use</Link></p>
              </div>
            )}
          </div>
        </div>
      )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* SuccessModal - uses Radix Portal so renders to document.body */}
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
    </div>
  );

  // Return the sidebar content directly (modal is inside but portals to document.body)
  return sidebarContent;
}
