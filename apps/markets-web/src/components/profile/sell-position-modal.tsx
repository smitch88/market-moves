"use client";

import { useState, useEffect } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  toast,
} from "@vault/ui";
import { Loader2, TrendingDown, AlertTriangle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@vault/ui/lib/utils";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

interface SellPositionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: {
    market: {
      id: string;
      question: string;
      outcomes: string;
      outcomePrices: string;
      event?: {
        title: string;
      };
    };
  };
  outcomeIndex: number;
  outcomeLabel: string;
  outcomeColor: string;
  maxShares: number;
  avgCost: number;
  onSellComplete: () => void;
}

interface SellQuote {
  outputAmount: number;
  avgPrice: number;
  priceImpact: number;
}

export function SellPositionModal({
  open,
  onOpenChange,
  position,
  outcomeIndex,
  outcomeLabel,
  outcomeColor,
  maxShares,
  avgCost,
  onSellComplete,
}: SellPositionModalProps) {
  const [sellAmount, setSellAmount] = useState("");
  const [quote, setQuote] = useState<SellQuote | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  const { market } = position;
  const title = market.event?.title || market.question;

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!open) {
      setSellAmount("");
      setQuote(null);
    }
  }, [open]);

  const sellMutation = useMutation({
    mutationFn: async (params: {
      marketId: string;
      outcomeIndex: number;
      shares: number;
    }): Promise<{ success: boolean; proceeds: number; message: string }> => {
      const res = await authFetch("/api/trades/sell", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to sell shares");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["user-stats"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["pnl-history"] });
      queryClient.invalidateQueries({ queryKey: ["positions-value"] });
      onSellComplete();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to sell shares");
    },
  });

  const handleSellAmountChange = async (value: string) => {
    setSellAmount(value);
    const sharesToSell = parseFloat(value);
    
    // Round to 2 decimal places for comparison to avoid floating point issues
    const sharesToSellRounded = Math.round(sharesToSell * 100) / 100;
    const maxSharesRounded = Math.round(maxShares * 100) / 100;
    
    if (isNaN(sharesToSell) || sharesToSell <= 0 || sharesToSellRounded > maxSharesRounded) {
      setQuote(null);
      return;
    }

    setLoadingQuote(true);
    try {
      // Use the actual maxShares value if they're effectively equal
      const actualShares = sharesToSellRounded >= maxSharesRounded ? maxShares : sharesToSell;
      const res = await authFetch("/api/trades/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketId: market.id, outcomeIndex, side: "sell", amount: actualShares }),
      });
      if (!res.ok) throw new Error("Failed to fetch quote");
      const q = await res.json();
      setQuote(q);
    } catch {
      setQuote(null);
      toast.error("Failed to get quote");
    } finally {
      setLoadingQuote(false);
    }
  };

  const handleMaxClick = () => {
    const max = maxShares.toFixed(2);
    setSellAmount(max);
    handleSellAmountChange(max);
  };

  const handleSell = () => {
    const sharesToSell = parseFloat(sellAmount);
    // Round to 2 decimal places for comparison
    const sharesToSellRounded = Math.round(sharesToSell * 100) / 100;
    const maxSharesRounded = Math.round(maxShares * 100) / 100;
    
    if (isNaN(sharesToSell) || sharesToSell <= 0 || sharesToSellRounded > maxSharesRounded) {
      toast.error("Invalid amount");
      return;
    }
    // Use the exact maxShares value if they're effectively equal
    const actualShares = sharesToSellRounded >= maxSharesRounded ? maxShares : sharesToSell;
    sellMutation.mutate({
      marketId: market.id,
      outcomeIndex,
      shares: actualShares,
    });
  };

  const sharesToSell = parseFloat(sellAmount) || 0;
  const costBasis = sharesToSell * avgCost;
  const proceeds = quote?.outputAmount || 0;
  const profit = proceeds - costBasis;
  // Round both values to 2 decimal places for comparison to avoid floating point issues
  const sharesToSellRounded = Math.round(sharesToSell * 100) / 100;
  const maxSharesRounded = Math.round(maxShares * 100) / 100;
  const hasError = sharesToSellRounded > maxSharesRounded;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-red-500" />
            Sell Position
          </DialogTitle>
          <DialogDescription className="text-left">
            {title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Position info */}
          <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center gap-3">
              <div
                className="w-2 h-8 rounded-full"
                style={{ backgroundColor: outcomeColor }}
              />
              <div>
                <div className="font-medium" style={{ color: outcomeColor }}>
                  {outcomeLabel}
                </div>
                <div className="text-sm text-muted-foreground">
                  {maxShares.toFixed(2)} shares available
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Avg cost</div>
              <div className="font-medium tabular-nums">${avgCost.toFixed(2)}</div>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Shares to sell</label>
            <div className="flex gap-2">
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={sellAmount}
                onChange={(e) => handleSellAmountChange(e.target.value)}
                className={cn(
                  "flex-1 tabular-nums",
                  hasError && "border-red-500 focus-visible:ring-red-500"
                )}
                autoFocus
              />
              <Button
                variant="outline"
                onClick={handleMaxClick}
                disabled={loadingQuote || sellMutation.isPending}
              >
                Max
              </Button>
            </div>
            {hasError && (
              <p className="text-xs text-red-500">
                Maximum {maxShares.toFixed(2)} shares available
              </p>
            )}
          </div>

          {/* Quote display */}
          {loadingQuote && (
            <div className="flex items-center justify-center py-4 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Getting quote...
            </div>
          )}

          {quote && !loadingQuote && sharesToSell > 0 && !hasError && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">You'll receive</span>
                <span className="font-bold text-lg text-green-500 tabular-nums">
                  ${quote.outputAmount.toFixed(2)}
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cost basis</span>
                <span className="tabular-nums">${costBasis.toFixed(2)}</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Profit/Loss</span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    profit >= 0 ? "text-green-500" : "text-red-500"
                  )}
                >
                  {profit >= 0 ? "+" : ""}${profit.toFixed(2)}
                </span>
              </div>

              {quote.priceImpact > 0.02 && (
                <div className="flex items-start gap-2 pt-2 border-t border-border">
                  <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-amber-600">
                    <span className="font-medium">High price impact:</span>{" "}
                    {(quote.priceImpact * 100).toFixed(1)}%
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sellMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSell}
              disabled={
                sellMutation.isPending ||
                !sellAmount ||
                sharesToSell <= 0 ||
                hasError ||
                !quote
              }
              className="flex-1"
            >
              {sellMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Selling...
                </>
              ) : (
                "Confirm sell"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
