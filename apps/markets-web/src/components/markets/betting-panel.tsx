"use client";

import { useState, useRef, useCallback } from "react";
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
import { ExternalLink, Check, Loader2, Sparkles, Trophy, Copy, Download, ImageIcon } from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";
import { toPng } from "html-to-image";
import type { Market, Outcome } from "@vault/database";
import { BettingTicket } from "./betting-ticket";

// Custom X (Twitter) logo icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface BettingPanelProps {
  market: Market & { outcomes: Outcome[] };
  stats: {
    percentA: number;
    percentB: number;
    totalPool: number;
  };
}

type BettingStep = "select" | "amount" | "tweet" | "verify" | "success";

export function BettingPanel({ market, stats }: BettingPanelProps) {
  const { login, authenticated, user } = usePrivy();
  const queryClient = useQueryClient();

  const [selectedOutcome, setSelectedOutcome] = useState<"A" | "B" | null>(null);
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<BettingStep>("select");
  const [betId, setBetId] = useState<string | null>(null);
  const [tweetUrl, setTweetUrl] = useState("");
  const [intentUrl, setIntentUrl] = useState("");

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
      setStep("tweet");
      toast.info("Bet reserved! Now share your prediction on X to confirm.");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to place bet");
    },
  });

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
      setIntentUrl(data.intentUrl);
      // Open tweet intent in new window
      window.open(data.intentUrl, "_blank", "width=550,height=420");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create tweet. Please try again.");
    },
  });

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
    onSuccess: (data) => {
      if (data.verified) {
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["market", market.slug] });
        handleBetSuccess();
      } else {
        toast.warning(data.message || "Tweet verification failed. Please make sure you posted the tweet and try again.");
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to verify tweet. Please try again.");
    },
  });

  const outcomeA = market.outcomes.find((o) => o.key === "A");
  const outcomeB = market.outcomes.find((o) => o.key === "B");

  const canBet =
    market.status === "OPEN" ||
    (market.status === "PUBLISHED" && (!market.closesAt || new Date(market.closesAt) > new Date()));

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
    tweetIntentMutation.mutate();
    setStep("verify");
  };

  const handleVerify = (method: "timeline" | "url") => {
    verifyTweetMutation.mutate(method);
  };

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [confirmedBetAmount, setConfirmedBetAmount] = useState(0);
  const [confirmedOutcome, setConfirmedOutcome] = useState<"A" | "B" | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [showTicketPreview, setShowTicketPreview] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const resetPanel = () => {
    setSelectedOutcome(null);
    setAmount("");
    setStep("select");
    setBetId(null);
    setTweetUrl("");
    setIntentUrl("");
    setShowSuccessModal(false);
    setShowTicketPreview(false);
  };

  // Get the confirmed outcome details
  const getConfirmedOutcomeDetails = () => {
    if (!confirmedOutcome) return null;
    const outcome = confirmedOutcome === "A" ? outcomeA : outcomeB;
    const percent = confirmedOutcome === "A" ? stats.percentA : stats.percentB;
    const isYes = confirmedOutcome === "A";
    return { outcome, percent, isYes };
  };

  const generateTicketImage = useCallback(async (): Promise<string | null> => {
    if (!ticketRef.current) return null;
    
    try {
      // Ensure the ticket is visible for rendering
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
    
    // Generate and download the image first
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        // Download the image
        const link = document.createElement("a");
        link.download = `vault-bet-${market.slug}.png`;
        link.href = dataUrl;
        link.click();
        
        // Small delay then open tweet intent
        setTimeout(() => {
          const tweetText = encodeURIComponent(
            `🎯 I just bet $${confirmedBetAmount.toLocaleString()} on "${outcome.label}" for "${market.title}" on @VaultMarkets!\n\nMake your prediction 👇\n${window.location.href}`
          );
          window.open(`https://x.com/intent/tweet?text=${tweetText}`, "_blank");
        }, 500);
        
        toast.success("Ticket downloaded! Attach it to your tweet.", { duration: 4000 });
      }
    } catch {
      toast.error("Failed to generate ticket");
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

  // Update the success step to show modal
  const handleBetSuccess = () => {
    setConfirmedBetAmount(parseInt(amount, 10));
    setConfirmedOutcome(selectedOutcome);
    setShowSuccessModal(true);
    setShowTicketPreview(true);
    setStep("select");
    setSelectedOutcome(null);
    setAmount("");
    setBetId(null);
    setTweetUrl("");
    setIntentUrl("");
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
            <>
              <p className="text-sm text-muted-foreground">Pick your prediction:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleSelectOutcome("A")}
                  className="flex-1 h-12 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-outcome-yes/[0.08] border border-outcome-yes/25 text-outcome-yes hover:bg-outcome-yes/[0.15] hover:border-outcome-yes/40"
                >
                  <span>{outcomeA?.label}</span>
                  <span className="opacity-60">{stats.percentA}%</span>
                </button>
                <button
                  onClick={() => handleSelectOutcome("B")}
                  className="flex-1 h-12 rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center gap-2 bg-outcome-no/[0.08] border border-outcome-no/25 text-outcome-no hover:bg-outcome-no/[0.15] hover:border-outcome-no/40"
                >
                  <span>{outcomeB?.label}</span>
                  <span className="opacity-60">{stats.percentB}%</span>
                </button>
              </div>
              {!authenticated && (
                <Button onClick={login} className="w-full">
                  Sign in to bet
                </Button>
              )}
            </>
          ) : step === "amount" ? (
            <>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  placeholder="Enter amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  max={balance}
                  min={1}
                />
                <div className="flex gap-2">
                  {[100, 500, 1000, balance].map((preset) => (
                    <Button
                      key={preset}
                      variant="ghost"
                      size="sm"
                      onClick={() => setAmount(String(Math.min(preset, balance)))}
                    >
                      {preset === balance ? "Max" : `$${preset}`}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("select")} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={handlePlaceBet}
                  disabled={!amount || parseInt(amount, 10) > balance || placeBetMutation.isPending}
                  className="flex-1"
                >
                  {placeBetMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Continue"
                  )}
                </Button>
              </div>
            </>
          ) : step === "tweet" ? (
            <>
              <p className="text-sm text-muted-foreground">
                Share your prediction on X to confirm your bet!
              </p>
              <Button onClick={handleOpenTweetIntent} className="w-full">
                <ExternalLink className="h-4 w-4 mr-2" />
                Post on X
              </Button>
            </>
          ) : step === "verify" ? (
            <>
              <p className="text-sm text-muted-foreground">
                After posting, verify your tweet:
              </p>
              <Button
                onClick={() => handleVerify("timeline")}
                disabled={verifyTweetMutation.isPending}
                className="w-full"
              >
                {verifyTweetMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Verify Tweet
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or paste URL</span>
                </div>
              </div>
              <Input
                placeholder="Paste your tweet URL"
                value={tweetUrl}
                onChange={(e) => setTweetUrl(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={() => handleVerify("url")}
                disabled={!tweetUrl || verifyTweetMutation.isPending}
                className="w-full"
              >
                Verify with URL
              </Button>
            </>
          ) : null}
        </GlassCardContent>
      </GlassCard>

      {/* Success Modal with Ticket */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-lg overflow-hidden p-0">
          <div className="relative">
            {/* Celebration background gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-background to-pink-900/30" />
            
            {/* Floating particles animation */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-purple-400/40"
                  initial={{ 
                    x: Math.random() * 400, 
                    y: 400,
                    scale: 0,
                    opacity: 0 
                  }}
                  animate={{ 
                    y: -100,
                    scale: [0, 1, 0.5],
                    opacity: [0, 1, 0],
                  }}
                  transition={{ 
                    duration: 2 + Math.random() * 2,
                    delay: Math.random() * 0.5,
                    repeat: Infinity,
                    repeatDelay: Math.random() * 2
                  }}
                />
              ))}
            </div>

            <div className="relative p-6 text-center space-y-5">
              {/* Success header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-center gap-2"
              >
                <Sparkles className="h-5 w-5 text-purple-400" />
                <h2 className="text-xl font-bold">Bet Confirmed!</h2>
                <Sparkles className="h-5 w-5 text-purple-400" />
              </motion.div>

              {/* Ticket Preview */}
              {showTicketPreview && confirmedOutcome && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", bounce: 0.3 }}
                  className="flex justify-center"
                >
                  <div className="rounded-lg overflow-hidden shadow-2xl shadow-purple-500/20 ring-1 ring-white/10">
                    <BettingTicket
                      ref={ticketRef}
                      market={market}
                      outcome={(confirmedOutcome === "A" ? outcomeA : outcomeB)!}
                      amount={confirmedBetAmount}
                      userName={profile?.name}
                      userHandle={profile?.handle}
                      userAvatar={profile?.profileImageUrl}
                    />
                  </div>
                </motion.div>
              )}

              {/* Action buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="space-y-3"
              >
                <p className="text-sm text-muted-foreground">Share your betting ticket</p>
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
                  <Button 
                    onClick={handleDownloadTicket}
                    disabled={isGeneratingImage}
                    variant="outline"
                    className="gap-2"
                  >
                    {isGeneratingImage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                  <Button 
                    onClick={handleCopyBetLink}
                    variant="outline"
                    className="gap-2"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </motion.div>

              {/* Close button */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Button 
                  onClick={() => setShowSuccessModal(false)} 
                  variant="ghost" 
                  className="w-full text-muted-foreground"
                >
                  Continue Browsing
                </Button>
              </motion.div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
