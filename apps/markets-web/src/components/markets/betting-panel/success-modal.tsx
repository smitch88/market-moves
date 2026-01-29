"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button, Dialog, DialogContent, Input, toast } from "@vault/ui";
import { Loader2, Copy, Download, Check, Sparkles } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XIcon } from "../x-icon";
import { BettingTicket } from "../betting-ticket";
import type { Market, Event } from "@vault/database";

interface SuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market;
  event: Event;
  outcomes: string[];
  confirmedOutcome: number | null;
  confirmedBetAmount: number;
  betId?: string | null;
  profile?: {
    name?: string | null;
    handle?: string | null;
    profileImageUrl?: string | null;
  } | null;
  ticketRef: React.RefObject<HTMLDivElement>;
  isGeneratingImage: boolean;
  copied: boolean;
  onShareOnX: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
}

const SHARE_XP_BONUS = 50;

export function SuccessModal({
  open,
  onOpenChange,
  market,
  event,
  outcomes,
  confirmedOutcome,
  confirmedBetAmount,
  betId,
  profile,
  ticketRef,
  isGeneratingImage,
  copied,
  onShareOnX,
  onDownload,
  onCopyLink,
}: SuccessModalProps) {
  const { user } = usePrivy();
  const queryClient = useQueryClient();
  const [xpClaimed, setXpClaimed] = useState(false);
  const [tweetUrl, setTweetUrl] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  const hasTwitter = !!user?.twitter;

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

  if (confirmedOutcome === null) return null;

  const confirmedOutcomeLabel = outcomes[confirmedOutcome];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md overflow-hidden p-0">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Success header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <h2 className="text-xl font-bold">Bet Confirmed!</h2>
            </div>
          </div>

          {/* Ticket Preview */}
          {confirmedOutcomeLabel && (
            <div className="flex justify-center">
              <BettingTicket
                ref={ticketRef}
                market={market}
                event={event}
                outcomeLabel={confirmedOutcomeLabel}
                outcomeIndex={confirmedOutcome}
                amount={confirmedBetAmount}
                userName={profile?.name}
                userHandle={profile?.handle}
                userAvatar={profile?.profileImageUrl}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">Share your betting ticket</p>
            <div className="flex gap-2">
              <Button
                onClick={onShareOnX}
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
              <Button onClick={onDownload} disabled={isGeneratingImage} variant="outline" className="gap-2">
                {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
              <Button onClick={onCopyLink} variant="outline" className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
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
          <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full text-muted-foreground">
            Continue Browsing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
