"use client";

import { useState } from "react";
import type { Market } from "@vault/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Badge,
} from "@vault/ui";
import { Info, Calendar, Clock, Trophy, ExternalLink, CheckCircle, XCircle, Lock } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { formatThresholdPrice } from "@/components/sports/market-utils";

interface MarketInfoModalProps {
  market: Market & { openingPrice?: number | null };
  outcomes?: string[];
  trigger?: React.ReactNode;
  className?: string;
}

// Format date in user's local timezone with full details
function formatDateTime(date: Date | string | null): string {
  if (!date) return "Not set";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// Format date in UTC
function formatDateTimeUTC(date: Date | string | null): string {
  if (!date) return "Not set";
  const d = typeof date === "string" ? new Date(date) : date;
  
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const month = months[d.getUTCMonth()];
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  const weekday = days[d.getUTCDay()];
  
  let hours = d.getUTCHours();
  const minutes = d.getUTCMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  
  return `${weekday}, ${month} ${day}, ${year} at ${hours}:${minutes} ${ampm} UTC`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case "OPEN":
      return <Badge variant="success">Open</Badge>;
    case "CLOSED":
      return <Badge variant="warning">Closed - Awaiting Resolution</Badge>;
    case "RESOLVED":
      return <Badge variant="default">Resolved - Awaiting Settlement</Badge>;
    case "SETTLED":
      return <Badge variant="success">Settled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function MarketInfoModal({ market, outcomes = [], trigger, className }: MarketInfoModalProps) {
  const [open, setOpen] = useState(false);
  
  const parsedOutcomes = outcomes.length > 0 ? outcomes : (() => {
    try {
      return JSON.parse(market.outcomes) as string[];
    } catch {
      return ["Yes", "No"];
    }
  })();

  const winningOutcome = market.resolvedOutcome !== null && market.resolvedOutcome !== undefined
    ? parsedOutcomes[market.resolvedOutcome]
    : null;

  const isClosed = market.status === "CLOSED" || market.status === "RESOLVED" || market.status === "SETTLED";
  const isResolved = market.status === "RESOLVED" || market.status === "SETTLED";

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(true);
  };

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {trigger || (
              <button
                type="button"
                onClick={handleClick}
                onMouseDown={(e) => e.stopPropagation()}
                className={cn(
                  "p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors",
                  className
                )}
              >
                <Info className="h-4 w-4" />
              </button>
            )}
          </TooltipTrigger>
          <TooltipContent side="top">
            <span>Market details</span>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Market Details
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Market Question */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1">Question</h4>
              <p className="text-sm font-medium">{market.question}</p>
            </div>

            {/* Resolution (auto-markets: Over/Under at threshold) */}
            {market.openingPrice != null && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-0.5">Resolution</h4>
                <p className="text-sm">
                  <strong>Over</strong> wins if price ≥ {formatThresholdPrice(Number(market.openingPrice))} at close · <strong>Under</strong> wins if price &lt; threshold
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Price data from{" "}
                  <a
                    href="https://www.coingecko.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    CoinGecko
                  </a>
                </p>
              </div>
            )}

            {/* Status */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground mb-1.5">Status</h4>
              {getStatusBadge(market.status)}
            </div>

            {/* Close Date */}
            <div className="flex items-start gap-3">
              <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-0.5">
                  {isClosed ? "Closed" : "Closes"}
                </h4>
                {market.closesAt ? (
                  <div>
                    <p className="text-sm font-medium">{formatDateTimeUTC(market.closesAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      Your time: {formatDateTime(market.closesAt)}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not set</p>
                )}
              </div>
            </div>

            {/* Resolution Date - Only show if resolved */}
            {isResolved && market.resolvedAt && (
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-0.5">Resolved</h4>
                  <div>
                    <p className="text-sm font-medium">{formatDateTimeUTC(market.resolvedAt)}</p>
                    <p className="text-xs text-muted-foreground">
                      Your time: {formatDateTime(market.resolvedAt)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Winning Outcome - Only show if resolved */}
            {winningOutcome && (
              <div className="flex items-start gap-3">
                <Trophy className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-0.5">Winning Outcome</h4>
                  <Badge variant="success" className="text-sm">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {winningOutcome}
                  </Badge>
                </div>
              </div>
            )}

            {/* Resolution Source */}
            {market.resolutionSourceUrl && (
              <div className="flex items-start gap-3">
                <ExternalLink className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-0.5">Resolution Source</h4>
                  <a
                    href={market.resolutionSourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                  >
                    View source
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}

            {/* Outcomes */}
            <div className="pt-2 border-t border-border">
              <h4 className="text-sm font-medium text-muted-foreground mb-2">Outcomes</h4>
              <div className="space-y-1.5">
                {parsedOutcomes.map((outcome, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-2 text-sm p-2 rounded-lg",
                      winningOutcome === outcome
                        ? "bg-chart-2/10 border border-chart-2/30"
                        : isResolved && winningOutcome !== outcome
                        ? "bg-muted/30 text-muted-foreground"
                        : "bg-muted/50"
                    )}
                  >
                    {winningOutcome === outcome ? (
                      <CheckCircle className="h-4 w-4 text-chart-2 shrink-0" />
                    ) : isResolved ? (
                      <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/50 shrink-0" />
                    )}
                    <span className={cn(winningOutcome === outcome && "font-medium text-chart-2")}>
                      {outcome}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
