"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
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
} from "@vault/ui";
import { AlertTriangle, Check, Loader2, Play, Lock, Trophy, Wallet } from "lucide-react";
import type { Market } from "@vault/database";

interface MarketActionsProps {
  market: Market;
  outcomes: string[];
}

export function MarketActions({ market, outcomes }: MarketActionsProps) {
  const router = useRouter();
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<string>("");

  const publishMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/markets/${market.id}/publish`, {
        method: "POST",
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
    mutationFn: async (outcomeIndex: number) => {
      const res = await fetch(`/api/admin/markets/${market.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ outcomeIndex }),
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

  const canPublish = market.status === "DRAFT";
  const canClose = market.status === "OPEN" || market.status === "PUBLISHED";
  const canResolve = market.status === "CLOSED";
  const canSettle = market.status === "RESOLVED" && !market.settledAt;
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
        </GlassCardContent>
      </GlassCard>

      {/* Resolve Dialog */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resolve Market</DialogTitle>
            <DialogDescription>
              Select the winning outcome. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => resolveMutation.mutate(parseInt(selectedOutcomeIndex, 10))}
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
    </>
  );
}
