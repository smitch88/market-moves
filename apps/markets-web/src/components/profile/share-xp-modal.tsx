"use client";

import { useState, useRef, useCallback } from "react";
import { useSession } from "@vault/auth/client";
import { Button, Dialog, DialogContent, Input, toast } from "@vault/ui";
import { Loader2, Copy, Download, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { BettingTicket } from "../markets/betting-ticket";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { useXPAnimation } from "@/components/layout/xp-animation";

// Custom X (Twitter) logo icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface UnsharedBet {
  id: string;
  marketId: string;
  outcomeIndex: number;
  amount: number;
  createdAt: string;
  market: {
    id: string;
    question: string;
    outcomes: string;
    event: {
      id: string;
      slug: string;
      title: string;
    };
  };
}

interface ShareXPModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bet: UnsharedBet;
  profile?: {
    name?: string | null;
    handle?: string | null;
    profileImageUrl?: string | null;
  } | null;
}

function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

export function ShareXPModal({ open, onOpenChange, bet, profile }: ShareXPModalProps) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();
  const { queueXPGain, flushQueue } = useXPAnimation();
  
  const [xpClaimed, setXpClaimed] = useState(false);
  const [claimedXPAmount, setClaimedXPAmount] = useState(0);
  const [tweetUrl, setTweetUrl] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  // With NextAuth Twitter is always connected (it's the only auth method)
  const hasTwitter = status === "authenticated";
  const outcomes = parseOutcomes(bet.market.outcomes);
  const outcomeLabel = outcomes[bet.outcomeIndex] || "Unknown";

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

  // Share for XP mutation
  const shareXPMutation = useMutation({
    mutationFn: async (method: "timeline" | "url") => {
      const res = await authFetch(`/api/bets/${bet.id}/share-xp`, {
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
        await queryClient.invalidateQueries({ queryKey: ["unshared-bets"] });
      } else {
        setShowManualEntry(true);
        toast.warning(data.message || "Could not find your tweet. Try pasting the URL below.");
      }
    },
    onError: (error: Error) => {
      if (error.message.includes("already claimed")) {
        setXpClaimed(true);
        toast.info("MP already claimed for this bet!");
        queryClient.invalidateQueries({ queryKey: ["unshared-bets"] });
      } else if (error.message.includes("already been used")) {
        toast.warning("This tweet was already used for MP. Please share a new tweet!");
      } else {
        setShowManualEntry(true);
        toast.error(error.message || "Failed to verify share");
      }
    },
  });

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

  const handleShareOnX = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);

        setTimeout(() => {
          const tweetText = encodeURIComponent(
            `🎯 I bet $${bet.amount.toLocaleString()} on "${outcomeLabel}" for "${bet.market.event.title}" on @UseVault777!\n\nMake your prediction 👇\n${window.location.origin}/markets/${bet.market.event.slug}`
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
  }, [generateTicketImage, bet, outcomeLabel]);

  const handleDownload = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = `vault-bet-${bet.market.event.slug}-${Date.now()}.png`;
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
  }, [generateTicketImage, bet.market.event.slug]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/markets/${bet.market.event.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md overflow-hidden p-0 max-h-[90vh]">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(90vh-2rem)]">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-xl font-bold">Boost Your MP</h2>
          </div>

          {/* Ticket Preview */}
          <div className="flex justify-center">
            <BettingTicket
              ref={ticketRef}
              market={{ ...bet.market, outcomes: bet.market.outcomes } as never}
              event={bet.market.event as never}
              outcomeLabel={outcomeLabel}
              outcomeIndex={bet.outcomeIndex}
              amount={bet.amount}
              userName={profile?.name}
              userHandle={profile?.handle}
              userAvatar={profile?.profileImageUrl}
              timestamp={new Date(bet.createdAt)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              onClick={handleShareOnX}
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
            <Button onClick={handleDownload} disabled={isGeneratingImage} variant="outline" className="gap-2">
              {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            </Button>
            <Button onClick={handleCopyLink} variant="outline" className="gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>

          {/* Claim XP Section */}
          {!xpClaimed && (
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

          {/* Close button */}
          <Button 
            onClick={() => {
              onOpenChange(false);
              // Flush animations after modal closes
              setTimeout(() => {
                flushQueue();
              }, 150);
            }} 
            variant="ghost" 
            className="w-full text-muted-foreground"
          >
            Continue Browsing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
