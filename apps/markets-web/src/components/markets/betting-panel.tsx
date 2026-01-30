"use client";

import { useState, useRef, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  toast,
} from "@vault/ui";
import { toPng } from "html-to-image";
import type { Market, Event } from "@vault/database";
import { BettingTicket } from "./betting-ticket";
import { SelectOutcomeStep } from "./betting-panel/select-outcome-step";
import { AmountStep } from "./betting-panel/amount-step";
import { SuccessModal } from "./betting-panel/success-modal";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

// Helper to parse outcomes from JSON
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

interface BettingPanelProps {
  market: Market;
  event: Event;
  stats: {
    percent0?: number;
    percent1?: number;
    percentA?: number;
    percentB?: number;
    totalPool: number;
  };
}

type BettingStep = "select" | "amount";

export function BettingPanel({ market, event, stats }: BettingPanelProps) {
  const { login, authenticated } = usePrivy();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  // Parse outcomes from market
  const outcomes = parseOutcomes(market.outcomes);

  // Betting flow state - using index (0 or 1) instead of key (A or B)
  const [step, setStep] = useState<BettingStep>("select");
  const [selectedOutcome, setSelectedOutcome] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [betId, setBetId] = useState<string | null>(null);

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmedBetAmount, setConfirmedBetAmount] = useState(0);
  const [confirmedOutcome, setConfirmedOutcome] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

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
  const canBet =
    market.status === "OPEN" ||
    (market.status === "PUBLISHED" && (!market.closesAt || new Date(market.closesAt) > new Date()));

  // Place bet mutation - bet is confirmed immediately (no tweet required)
  const placeBetMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
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
    onSuccess: async (data) => {
      // Store bet ID for potential share-for-XP
      setBetId(data.bet.id);
      
      // Invalidate and refetch queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile"] }),
        queryClient.refetchQueries({ queryKey: ["market", event.slug] }),
      ]);
      
      // Small delay to allow async XP award to complete on backend
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["xp"] });
      }, 500);
      
      // Show success modal (no toast needed - modal is shown)
      setConfirmedBetAmount(parseInt(amount, 10));
      setConfirmedOutcome(selectedOutcome);
      setShowSuccessModal(true);
      
      // Reset betting flow
      setStep("select");
      setSelectedOutcome(null);
      setAmount("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to place bet");
    },
  });

  // Handlers
  const handleSelectOutcome = (index: number) => {
    if (!authenticated) {
      login();
      return;
    }
    setSelectedOutcome(index);
    setStep("amount");
  };

  const handlePlaceBet = () => {
    if (!amount || parseInt(amount, 10) <= 0) return;
    placeBetMutation.mutate();
  };

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

  const handleShareTicketOnX = useCallback(async () => {
    const outcomeLabel = confirmedOutcome !== null ? outcomes[confirmedOutcome] : "";
    if (!outcomeLabel) return;

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

        toast.success("Ticket copied to clipboard! Paste it in your tweet.", { duration: 4000 });
      }
    } catch (error) {
      console.error("Failed to copy ticket:", error);
      toast.error("Failed to copy ticket to clipboard");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [generateTicketImage, event.slug, event.title, confirmedBetAmount, confirmedOutcome, outcomes]);

  const handleCopyBetLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <>
      <GlassCard variant="elevated">
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Place Your Bet</h2>
          {authenticated && (
            <p className="text-sm text-muted-foreground">
              Balance: <span className="text-[#df2421] font-medium">${balance.toLocaleString()}</span>
            </p>
          )}
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          {!canBet ? (
            <div className="text-center py-6">
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
                    : market.closesAt && new Date(market.closesAt) < new Date()
                      ? "Market Closed"
                      : "Trading Unavailable"
                }
              </h3>
              <p className="text-sm text-muted-foreground">
                {market.status === "SETTLED" 
                  ? "This market has been settled. Check your positions for any payouts."
                  : market.status === "RESOLVED"
                    ? "The outcome has been determined. Awaiting settlement."
                    : market.closesAt && new Date(market.closesAt) < new Date()
                      ? "This market has closed for betting."
                      : "This market is not currently open for trading."
                }
              </p>
            </div>
          ) : step === "select" ? (
            <SelectOutcomeStep
              outcomes={outcomes}
              stats={stats}
              authenticated={authenticated}
              onSelect={handleSelectOutcome}
              onLogin={login}
            />
          ) : step === "amount" ? (
            <AmountStep
              selectedOutcome={selectedOutcome}
              outcomes={outcomes}
              amount={amount}
              balance={balance}
              onAmountChange={setAmount}
              onBack={() => setStep("select")}
              onContinue={handlePlaceBet}
              isLoading={placeBetMutation.isPending}
            />
          ) : null}
        </GlassCardContent>
      </GlassCard>

      <SuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        market={market}
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
        onCopyLink={handleCopyBetLink}
      />
    </>
  );
}
