"use client";

import { useState, useRef, useCallback } from "react";
import { Button, Dialog, DialogContent, toast } from "@vault/ui";
import { Loader2, Copy, Download, Check, Trophy } from "lucide-react";
import { toPng } from "html-to-image";
import { WinningTicket } from "../markets/winning-ticket";

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

interface ShareWinModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Event title */
  eventTitle: string;
  /** Event slug for URL */
  eventSlug: string;
  /** Market question (optional) */
  marketQuestion?: string;
  /** Winning outcome label */
  outcomeLabel: string;
  /** Amount wagered (cost basis) */
  wager: number;
  /** Profit (payout - wager) */
  profit: number;
  /** Total payout */
  payout: number;
  /** Profit percentage */
  profitPercent: number;
  /** Date when market was settled */
  settledDate?: Date;
  /** User profile info */
  profile?: {
    name?: string | null;
    handle?: string | null;
    profileImageUrl?: string | null;
  } | null;
}

export function ShareWinModal({
  open,
  onOpenChange,
  eventTitle,
  eventSlug,
  marketQuestion,
  outcomeLabel,
  wager,
  profit,
  payout,
  profitPercent,
  settledDate,
  profile,
}: ShareWinModalProps) {
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

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
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);

        setTimeout(() => {
          const profitText = `+$${profit.toFixed(2)} (+${profitPercent.toFixed(0)}%)`;
          const tweetText = encodeURIComponent(
            `🏆 WINNER! I just cashed out ${profitText} on "${eventTitle}" betting "${outcomeLabel}" on @UseVault777!\n\nMake your prediction 👇\n${window.location.origin}/markets/${eventSlug}`
          );
          window.open(`https://x.com/intent/tweet?text=${tweetText}`, "_blank");
        }, 500);

        toast.success("Ticket copied to clipboard! Paste it in your tweet.", {
          duration: 4000,
        });
      }
    } catch (error) {
      console.error("Failed to copy ticket:", error);
      toast.error("Failed to copy ticket to clipboard");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [generateTicketImage, eventTitle, eventSlug, outcomeLabel, profit, profitPercent]);

  const handleDownload = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = `vault-win-${eventSlug}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("Winner ticket downloaded!");
      } else {
        toast.error("Failed to generate ticket");
      }
    } catch {
      toast.error("Failed to download ticket");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [generateTicketImage, eventSlug]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/markets/${eventSlug}`
      );
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
            <div className="flex items-center justify-center gap-2 mb-1">
              <Trophy className="h-6 w-6 text-green-500" />
              <h2 className="text-xl font-bold">Share Your Win!</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Show off your winning prediction
            </p>
          </div>

          {/* Ticket Preview */}
          <div className="flex justify-center">
            <WinningTicket
              ref={ticketRef}
              eventTitle={eventTitle}
              marketQuestion={marketQuestion}
              outcomeLabel={outcomeLabel}
              wager={wager}
              profit={profit}
              payout={payout}
              profitPercent={profitPercent}
              userName={profile?.name}
              userHandle={profile?.handle}
              userAvatar={profile?.profileImageUrl}
              settledDate={settledDate}
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
            <Button
              onClick={handleDownload}
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
            <Button onClick={handleCopyLink} variant="outline" className="gap-2">
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Profit summary */}
          <div className="flex items-center justify-center gap-4 pt-2 border-t border-border/50">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Wager</div>
              <div className="font-medium tabular-nums">${wager.toFixed(2)}</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Payout</div>
              <div className="font-medium tabular-nums text-green-500">
                ${payout.toFixed(2)}
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <div className="text-xs text-muted-foreground">Profit</div>
              <div className="font-bold tabular-nums text-green-500">
                +${profit.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Close button */}
          <Button
            onClick={() => onOpenChange(false)}
            variant="ghost"
            className="w-full text-muted-foreground"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
