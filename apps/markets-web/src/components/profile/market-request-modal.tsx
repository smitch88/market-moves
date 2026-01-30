"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Input,
  Textarea,
  toast,
  Label,
} from "@vault/ui";
import { Loader2, Lightbulb, ExternalLink } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

interface MarketRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketRequestModal({ open, onOpenChange }: MarketRequestModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const queryClient = useQueryClient();
  const authFetch = useAuthFetch();

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setSourceUrl("");
  };

  const createRequestMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; sourceUrl?: string }) => {
      const res = await authFetch("/api/market-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit request");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Market request submitted! We'll review it soon.");
      queryClient.invalidateQueries({ queryKey: ["market-requests"] });
      resetForm();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to submit request");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (title.length < 5) {
      toast.error("Title must be at least 5 characters");
      return;
    }
    if (description.length < 20) {
      toast.error("Description must be at least 20 characters");
      return;
    }

    createRequestMutation.mutate({
      title,
      description,
      sourceUrl: sourceUrl || undefined,
    });
  };

  const isValid = title.length >= 5 && description.length >= 20;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" />
            Request a Market
          </DialogTitle>
          <DialogDescription>
            Suggest a prediction market you'd like to see on Vault. We review all requests and may create markets based on community interest.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Market Title</Label>
            <Input
              id="title"
              placeholder="e.g., Will Bitcoin reach $100k by end of 2026?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              disabled={createRequestMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {title.length}/200 characters (minimum 5)
            </p>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe the market in detail. Include resolution criteria, relevant context, and why you think this would be interesting..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              disabled={createRequestMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              {description.length}/2000 characters (minimum 20)
            </p>
          </div>

          {/* Source URL */}
          <div className="space-y-2">
            <Label htmlFor="sourceUrl" className="flex items-center gap-2">
              Reference URL
              <span className="text-xs text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative">
              <Input
                id="sourceUrl"
                type="url"
                placeholder="https://polymarket.com/... or https://kalshi.com/..."
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                disabled={createRequestMutation.isPending}
                className="pr-10"
              />
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Link to a similar market on Polymarket, Kalshi, or another source
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={createRequestMutation.isPending}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createRequestMutation.isPending || !isValid}
              className="flex-1"
            >
              {createRequestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "Submit Request"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
