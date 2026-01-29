"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Button,
  toast,
  Skeleton,
} from "@vault/ui";
import { Gift, Check, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";

interface RedeemablePosition {
  positionId: string;
  marketId: string;
  marketQuestion: string;
  winningOutcome: string;
  payout: number;
  isWinner: boolean;
}

interface RedeemableSummary {
  totalRedeemable: number;
  positionsCount: number;
  winnersCount: number;
  losersCount: number;
  positions: RedeemablePosition[];
}

interface RedeemPositionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchRedeemable(): Promise<RedeemableSummary> {
  const res = await fetch("/api/me/redeem");
  if (!res.ok) throw new Error("Failed to fetch redeemable positions");
  return res.json();
}

async function redeemPositions(): Promise<{
  success: boolean;
  totalRedeemed: number;
  totalProfit: number;
  positionsRedeemed: number;
}> {
  const res = await fetch("/api/me/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error || "Redemption failed");
  }
  return res.json();
}

export function RedeemPositionsModal({ open, onOpenChange }: RedeemPositionsModalProps) {
  const queryClient = useQueryClient();
  const [redeemed, setRedeemed] = useState(false);
  const [redeemedAmount, setRedeemedAmount] = useState(0);

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["redeemable-positions"],
    queryFn: fetchRedeemable,
    enabled: open,
  });

  const redeemMutation = useMutation({
    mutationFn: redeemPositions,
    onSuccess: (data) => {
      setRedeemed(true);
      setRedeemedAmount(data.totalRedeemed);
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["redeemable-positions"] });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["user-stats"] });
      queryClient.invalidateQueries({ queryKey: ["user-activity"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to redeem positions");
    },
  });

  const handleRedeem = () => {
    redeemMutation.mutate();
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset state after modal closes
    setTimeout(() => {
      setRedeemed(false);
      setRedeemedAmount(0);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-green-500/10">
              <Gift className="h-5 w-5 text-green-500" />
            </div>
            {redeemed ? "Positions Redeemed!" : "Redeem Your Winnings"}
          </DialogTitle>
          <DialogDescription>
            {redeemed 
              ? "Your winnings have been added to your balance."
              : "Claim payouts from your winning positions."
            }
          </DialogDescription>
        </DialogHeader>

        {redeemed ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <p className="text-3xl font-bold text-green-500 mb-2">
              +${redeemedAmount.toFixed(2)}
            </p>
            <p className="text-muted-foreground">
              Successfully claimed to your balance
            </p>
            <Button onClick={handleClose} className="mt-6">
              Done
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4 py-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="py-8 text-center text-muted-foreground">
            Failed to load redeemable positions
          </div>
        ) : summary && summary.positionsCount > 0 ? (
          <div className="space-y-4">
            {/* Positions list */}
            <div className="max-h-64 overflow-y-auto space-y-2">
              {summary.positions.map((position) => (
                <div
                  key={position.positionId}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    position.isWinner 
                      ? "border-green-500/20 bg-green-500/5"
                      : "border-border bg-muted/30"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {position.marketQuestion}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">
                        {position.winningOutcome}
                      </span>
                      {position.isWinner ? (
                        <span className="text-xs text-green-500 flex items-center gap-0.5">
                          <TrendingUp className="h-3 w-3" />
                          Won
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                          <TrendingDown className="h-3 w-3" />
                          Lost
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    {position.isWinner ? (
                      <span className="font-bold text-green-500">
                        +${position.payout.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        $0.00
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <div className="text-sm text-muted-foreground">
                  {summary.winnersCount} winning • {summary.losersCount} losing
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Total Payout</div>
                  <div className="text-2xl font-bold text-green-500">
                    +${summary.totalRedeemable.toFixed(2)}
                  </div>
                </div>
              </div>

              <Button
                onClick={handleRedeem}
                disabled={redeemMutation.isPending || summary.totalRedeemable === 0}
                className="w-full bg-green-500 hover:bg-green-600"
                size="lg"
              >
                {redeemMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Claiming...
                  </>
                ) : (
                  <>
                    <Gift className="h-4 w-4 mr-2" />
                    Claim ${summary.totalRedeemable.toFixed(2)}
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            No positions to redeem
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
