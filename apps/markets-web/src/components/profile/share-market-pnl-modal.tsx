"use client";

import { useState, useRef, useCallback } from "react";
import { Button, Dialog, DialogContent, toast } from "@vault/ui";
import { Loader2, Copy, Download, Check, TrendingUp, TrendingDown } from "lucide-react";
import { toPng } from "html-to-image";
import { cn } from "@vault/ui/lib/utils";

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

interface MarketPosition {
  outcomeIndex: 0 | 1;
  shares: number;
  avgCost: number;
  currentValue: number;
  costBasis: number;
  pnl: number;
  didWin: boolean;
  settledValue: number;
  realizedPnL: number;
}

interface ShareMarketPnLModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventTitle: string;
  eventSlug: string;
  marketQuestion?: string;
  isSettled: boolean;
  outcomes: string[];
  outcomeColors: string[];
  positions: MarketPosition[];
  totalCost: number;
  totalValue: number;
  totalPnL: number;
  totalShares: number;
  profile?: {
    name?: string | null;
    handle?: string | null;
    profileImageUrl?: string | null;
  } | null;
}

export function ShareMarketPnLModal({
  open,
  onOpenChange,
  eventTitle,
  eventSlug,
  marketQuestion,
  isSettled,
  outcomes,
  outcomeColors,
  positions,
  totalCost,
  totalValue,
  totalPnL,
  totalShares,
  profile,
}: ShareMarketPnLModalProps) {
  const [copied, setCopied] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const ticketRef = useRef<HTMLDivElement>(null);

  const isProfitable = totalPnL > 0;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

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
          const pnlText = `${isProfitable ? "+" : ""}$${totalPnL.toFixed(2)} (${isProfitable ? "+" : ""}${pnlPercent.toFixed(0)}%)`;
          const status = isSettled ? "closed" : "holding";
          const emoji = isProfitable ? "📈" : "📉";
          const tweetText = encodeURIComponent(
            `${emoji} ${isProfitable ? "Profit" : "Loss"} on "${eventTitle}": ${pnlText}\n\nI ${status} my position on @UseVault777!\n\nMake your prediction 👇\n${window.location.origin}/markets/${eventSlug}`
          );
          window.open(`https://x.com/intent/tweet?text=${tweetText}`, "_blank");
        }, 500);

        toast.success("Card copied to clipboard! Paste it in your tweet.", {
          duration: 4000,
        });
      }
    } catch (error) {
      console.error("Failed to copy card:", error);
      toast.error("Failed to copy card to clipboard");
    } finally {
      setIsGeneratingImage(false);
    }
  }, [generateTicketImage, eventTitle, eventSlug, isProfitable, totalPnL, pnlPercent, isSettled]);

  const handleDownload = useCallback(async () => {
    setIsGeneratingImage(true);
    try {
      const dataUrl = await generateTicketImage();
      if (dataUrl) {
        const link = document.createElement("a");
        link.download = `vault-pnl-${eventSlug}-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
        toast.success("P&L card downloaded!");
      } else {
        toast.error("Failed to generate card");
      }
    } catch {
      toast.error("Failed to download card");
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

  const accentColor = isProfitable ? "#22c55e" : "#ef4444";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md overflow-hidden p-0 max-h-[90vh]">
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto max-h-[calc(90vh-2rem)]">
          {/* Header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              {isProfitable ? (
                <TrendingUp className="h-6 w-6 text-green-500" />
              ) : (
                <TrendingDown className="h-6 w-6 text-red-500" />
              )}
              <h2 className="text-xl font-bold">Share Your P&L</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Share your {isSettled ? "results" : "position"} on this market
            </p>
          </div>

          {/* Card Preview */}
          <div className="flex justify-center">
            <div
              ref={ticketRef}
              className="w-[380px] max-w-full rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(145deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)",
                border: `2px solid ${accentColor}33`,
                fontFamily: "'Inter', system-ui, sans-serif",
              }}
            >
              {/* Header */}
              <div className="px-5 pt-5 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <img src="/logo.svg" alt="Vault Markets" className="w-10 h-10" />
                  <div
                    className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: `${accentColor}20`,
                      color: accentColor,
                      border: `1px solid ${accentColor}40`,
                    }}
                  >
                    {isSettled ? "Closed" : "Open"} Position
                  </div>
                </div>
                <h3 className="text-white font-semibold text-lg leading-tight line-clamp-2">
                  {eventTitle}
                </h3>
                {marketQuestion && marketQuestion !== eventTitle && (
                  <p className="text-white/50 text-sm mt-1 line-clamp-1">{marketQuestion}</p>
                )}
              </div>

              {/* P&L Section */}
              <div
                className="px-5 py-4 mx-3 rounded-xl mb-3"
                style={{
                  background: `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}05 100%)`,
                  border: `1px solid ${accentColor}30`,
                }}
              >
                <div className="text-center">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">
                    {isSettled ? "Realized P&L" : "Unrealized P&L"}
                  </div>
                  <div
                    className="text-4xl font-bold"
                    style={{ color: accentColor }}
                  >
                    {isProfitable ? "+" : ""}${Math.abs(totalPnL).toFixed(2)}
                  </div>
                  <div
                    className="text-lg font-medium mt-0.5"
                    style={{ color: accentColor }}
                  >
                    {isProfitable ? "+" : ""}{pnlPercent.toFixed(1)}% ROI
                  </div>
                </div>
              </div>

              {/* Positions breakdown */}
              <div className="px-5 pb-3">
                <div className="text-white/40 text-xs uppercase tracking-wider mb-2">
                  Positions
                </div>
                <div className="space-y-2">
                  {positions.map((pos, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: outcomeColors[pos.outcomeIndex] || "#666" }}
                        />
                        <span className="text-white/70">
                          {outcomes[pos.outcomeIndex] || `Outcome ${pos.outcomeIndex}`}
                        </span>
                        <span className="text-white/40 text-xs">
                          {pos.shares.toFixed(0)} shares
                        </span>
                      </div>
                      <span
                        className="font-medium tabular-nums"
                        style={{
                          color: (isSettled ? pos.realizedPnL : pos.pnl) >= 0 ? "#22c55e" : "#ef4444",
                        }}
                      >
                        {(isSettled ? pos.realizedPnL : pos.pnl) >= 0 ? "+" : ""}
                        ${Math.abs(isSettled ? pos.realizedPnL : pos.pnl).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Stats row */}
              <div className="px-5 py-3 border-t border-white/10 flex justify-between text-xs">
                <div className="text-white/40">
                  Cost: <span className="text-white/70 tabular-nums">${totalCost.toFixed(2)}</span>
                </div>
                <div className="text-white/40">
                  Value: <span className="text-white/70 tabular-nums">${totalValue.toFixed(2)}</span>
                </div>
              </div>

              {/* Branding footer */}
              <div className="px-5 py-3 border-t border-white/10 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-white/70 text-sm">MARKETS.</span>
                  <span style={{ color: accentColor }} className="text-sm font-medium">
                    VAULT777.com
                  </span>
                </div>
              </div>
            </div>
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
