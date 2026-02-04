"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Badge,
  Input,
  Label,
} from "@vault/ui";
import { AlertTriangle, Check, Loader2, Play, Lock, Trophy, Wallet, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { Market } from "@vault/database";
import type { MarketHealthResponse } from "@/app/api/admin/markets/[id]/health/route";
import type { RecalibrationSimulation } from "@/app/api/admin/markets/[id]/recalibrate/simulate/route";

interface MarketActionsProps {
  market: Market;
  outcomes: string[];
}

export function MarketActions({ market, outcomes }: MarketActionsProps) {
  const router = useRouter();
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [recalibrateDialogOpen, setRecalibrateDialogOpen] = useState(false);
  const [showPositionDetails, setShowPositionDetails] = useState(false);
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<string>("");
  const [resolutionSourceUrl, setResolutionSourceUrl] = useState(market.resolutionSourceUrl || "");

  // Fetch market health when recalibrate dialog is opened
  const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery<MarketHealthResponse>({
    queryKey: ["market-health", market.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/markets/${market.id}/health`);
      if (!res.ok) throw new Error("Failed to fetch market health");
      return res.json();
    },
    enabled: recalibrateDialogOpen,
  });

  // Fetch simulation data when recalibrate dialog is opened
  const { data: simulationData, isLoading: simulationLoading, refetch: refetchSimulation } = useQuery<RecalibrationSimulation>({
    queryKey: ["recalibrate-simulation", market.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/markets/${market.id}/recalibrate/simulate`);
      if (!res.ok) throw new Error("Failed to fetch simulation");
      return res.json();
    },
    enabled: recalibrateDialogOpen,
  });

  // Refetch data when dialog opens
  useEffect(() => {
    if (recalibrateDialogOpen) {
      refetchHealth();
      refetchSimulation();
      setShowPositionDetails(false);
    }
  }, [recalibrateDialogOpen, refetchHealth, refetchSimulation]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/markets/${market.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: true }),
      });
      if (!res.ok) throw new Error("Failed to publish market");
      return res.json();
    },
    onSuccess: () => router.refresh(),
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/markets/${market.id}/close`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to close market");
      return res.json();
    },
    onSuccess: () => router.refresh(),
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ outcomeIndex, sourceUrl }: { outcomeIndex: number; sourceUrl?: string }) => {
      const res = await fetch(`/api/admin/markets/${market.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeIndex, resolutionSourceUrl: sourceUrl }),
      });
      if (!res.ok) throw new Error("Failed to resolve market");
      return res.json();
    },
    onSuccess: () => {
      setResolveDialogOpen(false);
      router.refresh();
    },
  });

  const settleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/markets/${market.id}/settle`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to settle market");
      }
      return res.json();
    },
    onSuccess: () => {
      setSettleDialogOpen(false);
      router.refresh();
    },
  });

  const recalibrateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/markets/${market.id}/recalibrate`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to recalibrate market");
      }
      return res.json();
    },
    onSuccess: () => {
      setRecalibrateDialogOpen(false);
      router.refresh();
    },
  });

  const canPublish = market.status === "DRAFT";
  const canClose = market.status === "OPEN" || market.status === "PUBLISHED";
  const canResolve = market.status === "CLOSED";
  const canSettle = market.status === "RESOLVED" && !market.settledAt;
  const canRecalibrate = market.status === "DRAFT" || market.status === "OPEN";
  const isSettled = !!market.settledAt;
  const resolvedOutcome = market.resolvedOutcome;

  return (
    <>
      <GlassCard>
        <GlassCardHeader>
          <h3 className="text-sm font-semibold">Actions</h3>
        </GlassCardHeader>
        <GlassCardContent className="space-y-3">
          {canPublish && (
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
              className="w-full"
            >
              {publishMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Publish Market
            </Button>
          )}

          {canClose && (
            <Button
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
              variant="outline"
              className="w-full"
            >
              {closeMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Close Market
            </Button>
          )}

          {canResolve && (
            <Button
              onClick={() => setResolveDialogOpen(true)}
              variant="outline"
              className="w-full"
            >
              <Trophy className="h-4 w-4 mr-2" />
              Resolve Market
            </Button>
          )}

          {canSettle && (
            <Button
              onClick={() => setSettleDialogOpen(true)}
              className="w-full"
            >
              <Wallet className="h-4 w-4 mr-2" />
              Run Settlement
            </Button>
          )}

          {isSettled && (
            <div className="flex items-center justify-center gap-2 py-2 text-chart-2">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Settlement Complete</span>
            </div>
          )}

          {resolvedOutcome !== null && resolvedOutcome !== undefined && (
            <div className="pt-2 border-t border-border">
              <p className="text-sm text-muted-foreground">Resolved Outcome:</p>
              <Badge variant="success" className="mt-1">
                {outcomes[resolvedOutcome]}
              </Badge>
            </div>
          )}

          {/* Recalibrate option for fixing broken markets */}
          {canRecalibrate && (
            <div className="pt-3 border-t border-border">
              <Button
                onClick={() => setRecalibrateDialogOpen(true)}
                variant="outline"
                size="sm"
                className="w-full text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Recalibrate AMM
              </Button>
              <p className="text-xs text-muted-foreground mt-1.5 text-center">
                Fix broken pricing or liquidity issues
              </p>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Market</DialogTitle>
            <DialogDescription>
              Select the winning outcome and provide a resolution source. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Winning Outcome</Label>
              <Select value={selectedOutcomeIndex} onValueChange={setSelectedOutcomeIndex}>
                <SelectTrigger>
                  <SelectValue placeholder="Select winning outcome" />
                </SelectTrigger>
                <SelectContent>
                  {outcomes.map((outcome, index) => (
                    <SelectItem key={index} value={String(index)}>
                      {outcome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="resolutionSourceUrl">Resolution Source URL</Label>
              <Input
                id="resolutionSourceUrl"
                type="url"
                placeholder="https://example.com/source"
                value={resolutionSourceUrl}
                onChange={(e) => setResolutionSourceUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Link to the official source confirming the outcome (e.g., ESPN, official league site)
              </p>
            </div>
            
            {market.resolutionSourceUrl && resolutionSourceUrl !== market.resolutionSourceUrl && (
              <p className="text-xs text-amber-500">
                Note: This will update the existing resolution source URL
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => resolveMutation.mutate({ 
                outcomeIndex: parseInt(selectedOutcomeIndex, 10),
                sourceUrl: resolutionSourceUrl || undefined
              })}
              disabled={selectedOutcomeIndex === "" || resolveMutation.isPending}
            >
              {resolveMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settle Dialog */}
      <Dialog open={settleDialogOpen} onOpenChange={setSettleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Run Settlement
            </DialogTitle>
            <DialogDescription>
              This will distribute payouts to all winning bettors and update balances.
              This action can only be run once and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-2">
            {resolvedOutcome !== null && resolvedOutcome !== undefined && (
              <p className="text-sm">
                <span className="text-muted-foreground">Winning outcome:</span>{" "}
                <span className="font-medium">{outcomes[resolvedOutcome]}</span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettleDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => settleMutation.mutate()}
              disabled={settleMutation.isPending}
            >
              {settleMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirm Settlement
            </Button>
          </DialogFooter>
          {settleMutation.isError && (
            <p className="text-destructive text-sm text-center">
              {settleMutation.error instanceof Error
                ? settleMutation.error.message
                : "Settlement failed"}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Recalibrate Dialog */}
      <Dialog open={recalibrateDialogOpen} onOpenChange={setRecalibrateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-amber-500" />
              Recalibrate Market AMM - Simulation
            </DialogTitle>
            <DialogDescription>
              Review the simulated changes before confirming. No changes will be made until you confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {/* Loading State */}
            {(healthLoading || simulationLoading) ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Running simulation...</span>
              </div>
            ) : healthData && simulationData ? (
              <>
                {/* Health Status */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Market Status:</span>
                  <Badge 
                    variant={
                      healthData.status === "healthy" ? "success" : 
                      healthData.status === "warning" ? "warning" : 
                      "destructive"
                    }
                  >
                    {healthData.status === "healthy" ? "Healthy" :
                     healthData.status === "warning" ? "Warning" :
                     "Broken"}
                  </Badge>
                </div>

                {/* Issues */}
                {healthData.issues.length > 0 && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-destructive">Issues detected:</p>
                        <ul className="text-xs text-destructive/80 space-y-0.5">
                          {healthData.issues.map((issue, i) => (
                            <li key={i}>• {issue}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pool-Weighted Pricing Info */}
                {simulationData.market.pools && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                    <p className="text-xs font-medium text-blue-600 mb-2">Pool-Weighted Pricing</p>
                    <div className="grid grid-cols-2 gap-4 text-xs text-blue-500/80">
                      <div>
                        <p>Outcome 0 Pool: ${simulationData.market.pools.totalPool0.toLocaleString()}</p>
                        <p>Outcome 1 Pool: ${simulationData.market.pools.totalPool1.toLocaleString()}</p>
                      </div>
                      <div>
                        <p>New prices reflect actual betting sentiment</p>
                        <p>Liquidity depth preserved from seeds</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Market Changes */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <p className="font-medium text-muted-foreground">Current Market State</p>
                    <div className="bg-muted/30 rounded-lg p-3 space-y-1 text-xs">
                      <p>Reserve 0: <span className="font-mono">{simulationData.market.before.reserve0.toFixed(2)}</span></p>
                      <p>Reserve 1: <span className="font-mono">{simulationData.market.before.reserve1.toFixed(2)}</span></p>
                      <p>Price: <span className="font-mono text-destructive">{(simulationData.market.before.price0 * 100).toFixed(2)}% / {(simulationData.market.before.price1 * 100).toFixed(2)}%</span></p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="font-medium text-muted-foreground">After Recalibration</p>
                    <div className="bg-chart-2/10 border border-chart-2/20 rounded-lg p-3 space-y-1 text-xs">
                      <p>Reserve 0: <span className="font-mono">{simulationData.market.after.reserve0.toFixed(2)}</span></p>
                      <p>Reserve 1: <span className="font-mono">{simulationData.market.after.reserve1.toFixed(2)}</span></p>
                      <p>Price: <span className="font-mono text-chart-2">{(simulationData.market.after.price0 * 100).toFixed(2)}% / {(simulationData.market.after.price1 * 100).toFixed(2)}%</span></p>
                    </div>
                  </div>
                </div>

                {/* Summary */}
                {simulationData.summary.positionsWithShares > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      <div className="text-xs space-y-2 flex-1">
                        <p className="font-medium text-amber-600">
                          {simulationData.summary.positionsWithShares} position(s) will be adjusted
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-amber-500/80">
                          <div>
                            <p>Total Cost Basis: ${simulationData.summary.totalCostBasisBefore.toFixed(2)}</p>
                            <p>Current Value: ${simulationData.summary.totalValueBefore.toFixed(2)}</p>
                          </div>
                          <div>
                            <p>After Cost Basis: ${simulationData.summary.totalCostBasisAfter.toFixed(2)}</p>
                            <p>After Value: ${simulationData.summary.totalValueAfter.toFixed(2)}</p>
                          </div>
                        </div>
                        <p className="text-amber-500/70 pt-1">
                          Cost basis is preserved - users keep the same invested amount.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Position Details Toggle */}
                {simulationData.positions.length > 0 && (
                  <div className="border border-border/50 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setShowPositionDetails(!showPositionDetails)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors"
                    >
                      <span className="text-sm font-medium">
                        Position Details ({simulationData.positions.length} users)
                      </span>
                      {showPositionDetails ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    
                    {showPositionDetails && (
                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted/30 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-medium text-muted-foreground">User</th>
                              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cost Basis</th>
                              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Shares Before</th>
                              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Shares After</th>
                              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Change</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {simulationData.positions.map((pos) => (
                              <tr key={pos.positionId} className="hover:bg-muted/10">
                                <td className="px-3 py-2">
                                  <div className="font-medium">{pos.userName || pos.userHandle || "Unknown"}</div>
                                  {pos.userHandle && pos.userName && (
                                    <div className="text-muted-foreground">@{pos.userHandle}</div>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  ${pos.before.totalCostBasis.toFixed(2)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  <div>{pos.before.shares0.toFixed(2)} / {pos.before.shares1.toFixed(2)}</div>
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  <div>{pos.after.shares0.toFixed(2)} / {pos.after.shares1.toFixed(2)}</div>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <div className={`font-mono ${pos.change.shares0Pct > 0 ? 'text-chart-2' : pos.change.shares0Pct < 0 ? 'text-destructive' : ''}`}>
                                    {pos.change.shares0Pct > 0 ? '+' : ''}{pos.change.shares0Pct.toFixed(1)}%
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {simulationData.positions.length === 0 && (
                  <div className="bg-chart-2/10 border border-chart-2/20 rounded-lg p-3 text-center">
                    <p className="text-sm text-chart-2">
                      No positions to adjust - market has no active bets.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to fetch simulation data.</p>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setRecalibrateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => recalibrateMutation.mutate()}
              disabled={recalibrateMutation.isPending || healthLoading || simulationLoading}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              {recalibrateMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Confirm Recalibration
            </Button>
          </DialogFooter>

          {recalibrateMutation.isError && (
            <p className="text-destructive text-sm text-center">
              {recalibrateMutation.error instanceof Error
                ? recalibrateMutation.error.message
                : "Recalibration failed"}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
