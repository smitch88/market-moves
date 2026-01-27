"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Input,
  Label,
  Dialog,
  DialogContent,
  toast,
} from "@vault/ui";
import { Check, Loader2, Sparkles, Copy, Download } from "lucide-react";
import { toPng } from "html-to-image";
import type { Market, Outcome } from "@vault/database";
import { BettingTicket } from "./betting-ticket";
import { XIcon } from "./x-icon";
import { SelectOutcomeStep } from "./betting-panel/select-outcome-step";
import { AmountStep } from "./betting-panel/amount-step";
import { VerifyStep } from "./betting-panel/verify-step";
import { SuccessModal } from "./betting-panel/success-modal";

interface BettingPanelProps {
  market: Market & { outcomes: Outcome[] };
  stats: {
    percentA: number;
    percentB: number;
    totalPool: number;
  };
}

type BettingStep = "select" | "amount" | "verify";

export function BettingPanel({ market, stats }: BettingPanelProps) {
  const { login, authenticated } = usePrivy();
  const queryClient = useQueryClient();

  // Betting flow state
  const [step, setStep] = useState<BettingStep>("select");
  const [selectedOutcome, setSelectedOutcome] = useState<"A" | "B" | null>(null);
  const [amount, setAmount] = useState("");
  const [betId, setBetId] = useState<string | null>(null);
  const [tweetUrl, setTweetUrl] = useState("");

  // Success modal state
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmedBetAmount, setConfirmedBetAmount] = useState(0);
  const [confirmedOutcome, setConfirmedOutcome] = useState<"A" | "B" | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

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

  // Check for pending bets
  const { data: pendingBetData } = useQuery({
    queryKey: ["pendingBet", market.id],
    queryFn: async () => {
      const res = await fetch(`/api/bets/pending?marketId=${market.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: authenticated,
  });

  const balance = profile?.balance ?? 10000;
  const outcomeA = market.outcomes.find((o) => o.key === "A");
  const outcomeB = market.outcomes.find((o) => o.key === "B");
  const canBet =
    market.status === "OPEN" ||
    (market.status === "PUBLISHED" && (!market.closesAt || new Date(market.closesAt) > new Date()));

  // Initialize pending bet if found
  useEffect(() => {
    if (pendingBetData?.pendingBet && !betId && step === "select") {
      const pendingBet = pendingBetData.pendingBet;
      setBetId(pendingBet.id);
      setSelectedOutcome(pendingBet.outcome.key as "A" | "B");
      setAmount(String(pendingBet.amount));
      setStep("verify");
    }
  }, [pendingBetData, betId, step]);

  // Place bet mutation
  const placeBetMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/bets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketId: market.id,
          outcomeKey: selectedOutcome,
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
      queryClient.invalidateQueries({ queryKey: ["pendingBet", market.id] });
      toast.info("Bet reserved! Now share your prediction on X to confirm.");
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
      toast.error(error.message || "Failed to create tweet. Please try again.");
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
        // Reset state immediately to prevent re-initialization
        setBetId(null);
        setStep("select");
        setSelectedOutcome(null);
        setAmount("");
        setTweetUrl("");
        
        // Invalidate and refetch queries
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["profile"] }),
          queryClient.refetchQueries({ queryKey: ["market", market.slug] }),
          queryClient.refetchQueries({ queryKey: ["pendingBet", market.id] }),
        ]);
        
        // Show success modal
        handleBetSuccess();
      } else {
        toast.warning(
          data.message || "Tweet verification failed. Please make sure you posted the tweet and try again."
        );
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to verify tweet. Please try again.");
    },
  });

  // Handlers
  const handleSelectOutcome = (key: "A" | "B") => {
    if (!authenticated) {
      login();
      return;
    }
    setSelectedOutcome(key);
    setStep("amount");
  };

  const handlePlaceBet = () => {
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

  const handleBetSuccess = () => {
    setConfirmedBetAmount(parseInt(amount, 10));
    setConfirmedOutcome(selectedOutcome);
    setShowSuccessModal(true);
    // Reset betting flow
    setStep("select");
    setSelectedOutcome(null);
    setAmount("");
    setBetId(null);
    setTweetUrl("");
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

  const handleDownloadTicket = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = `vault-bet-${market.slug}-${Date.now()}.png`;
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
  }, [generateTicketImage, market.slug]);

  const handleShareTicketOnX = useCallback(async () => {
    const outcome = confirmedOutcome === "A" ? outcomeA : outcomeB;
    if (!outcome) return;

    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

        setTimeout(() => {
          const tweetText = encodeURIComponent(
            `🎯 I just bet $${confirmedBetAmount.toLocaleString()} on "${outcome.label}" for "${market.title}" on @VaultMarkets!\n\nMake your prediction 👇\n${window.location.href}`
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
  }, [generateTicketImage, market.slug, market.title, confirmedBetAmount, confirmedOutcome, outcomeA, outcomeB]);

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
            <p className="text-center text-muted-foreground py-4">
              This market is no longer accepting bets
            </p>
          ) : step === "select" ? (
            <SelectOutcomeStep
              outcomeA={outcomeA}
              outcomeB={outcomeB}
              stats={stats}
              authenticated={authenticated}
              onSelect={handleSelectOutcome}
              onLogin={login}
            />
          ) : step === "amount" ? (
            <AmountStep
              selectedOutcome={selectedOutcome}
              outcomeA={outcomeA}
              outcomeB={outcomeB}
              amount={amount}
              balance={balance}
              onAmountChange={setAmount}
              onBack={() => setStep("select")}
              onContinue={handlePlaceBet}
              isLoading={placeBetMutation.isPending}
            />
          ) : step === "verify" ? (
            <VerifyStep
              pendingBet={pendingBetData?.pendingBet}
              selectedOutcome={selectedOutcome}
              outcomeA={outcomeA}
              outcomeB={outcomeB}
              tweetUrl={tweetUrl}
              onTweetUrlChange={setTweetUrl}
              onOpenTweetIntent={handleOpenTweetIntent}
              onVerify={handleVerify}
              isLoading={verifyTweetMutation.isPending}
            />
          ) : null}
        </GlassCardContent>
      </GlassCard>

      <SuccessModal
        open={showSuccessModal}
        onOpenChange={setShowSuccessModal}
        market={market}
        outcomeA={outcomeA}
        outcomeB={outcomeB}
        confirmedOutcome={confirmedOutcome}
        confirmedBetAmount={confirmedBetAmount}
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
