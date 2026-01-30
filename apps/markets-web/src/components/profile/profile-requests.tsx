"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Badge, Button } from "@vault/ui";
import { Lightbulb, ExternalLink, Clock, CheckCircle, XCircle, Sparkles, Loader2 } from "lucide-react";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

interface MarketRequest {
  id: string;
  title: string;
  description: string;
  sourceUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CREATED";
  adminNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  reviewer?: {
    name: string | null;
    handle: string | null;
  } | null;
}

interface ProfileRequestsProps {
  onRequestNew: () => void;
}

const statusConfig = {
  PENDING: {
    label: "Pending Review",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: XCircle,
  },
  CREATED: {
    label: "Market Created",
    color: "bg-primary/10 text-primary border-primary/20",
    icon: Sparkles,
  },
};

export function ProfileRequests({ onRequestNew }: ProfileRequestsProps) {
  const authFetch = useAuthFetch();

  const { data: requests, isLoading } = useQuery<MarketRequest[]>({
    queryKey: ["market-requests"],
    queryFn: async () => {
      const res = await authFetch("/api/me/market-requests");
      if (!res.ok) return [];
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Lightbulb className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No market requests yet</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Have an idea for a prediction market? Submit a request and our team will review it.
        </p>
        <Button onClick={onRequestNew} className="gap-2">
          <Lightbulb className="h-4 w-4" />
          Request a Market
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with action */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">Your Market Requests</h3>
          <p className="text-sm text-muted-foreground">
            Track the status of your submitted market ideas
          </p>
        </div>
        <Button onClick={onRequestNew} variant="outline" size="sm" className="gap-2">
          <Lightbulb className="h-4 w-4" />
          New Request
        </Button>
      </div>

      {/* Request list */}
      <div className="space-y-4">
        {requests.map((request) => {
          const config = statusConfig[request.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={request.id}
              className="border border-border rounded-lg p-4 space-y-3"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-sm sm:text-base truncate">{request.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted {format(new Date(request.createdAt), "MMM d, yyyy")}
                  </p>
                </div>
                <Badge variant="outline" className={config.color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {config.label}
                </Badge>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground line-clamp-2">
                {request.description}
              </p>

              {/* Source URL */}
              {request.sourceUrl && (
                <a
                  href={request.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  View Reference
                </a>
              )}

              {/* Admin response */}
              {request.adminNotes && (
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Admin Response
                    {request.reviewedAt && (
                      <span className="ml-2 font-normal">
                        · {format(new Date(request.reviewedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </p>
                  <p className="text-sm">{request.adminNotes}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
