import * as React from "react";
import { cn } from "../lib/utils";
import { Check, Clock, CircleDot, Lock, Trophy, Wallet } from "lucide-react";

export type MarketStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "OPEN"
  | "CLOSED"
  | "RESOLVED"
  | "SETTLED"
  | "CANCELLED";

interface TimelineStep {
  status: MarketStatus;
  label: string;
  description: string;
  icon: React.ReactNode;
  timestamp?: Date | string | null;
}

interface MarketTimelineProps {
  currentStatus: MarketStatus;
  publishedAt?: Date | string | null;
  opensAt?: Date | string | null;
  closesAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  settledAt?: Date | string | null;
  className?: string;
}

const statusOrder: MarketStatus[] = [
  "PUBLISHED",
  "OPEN",
  "CLOSED",
  "RESOLVED",
  "SETTLED",
];

function getStatusIndex(status: MarketStatus): number {
  const idx = statusOrder.indexOf(status);
  return idx === -1 ? 0 : idx;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function MarketTimeline({
  currentStatus,
  publishedAt,
  opensAt,
  closesAt,
  resolvedAt,
  settledAt,
  className,
}: MarketTimelineProps) {
  const currentIndex = getStatusIndex(currentStatus);

  const steps: TimelineStep[] = [
    {
      status: "PUBLISHED",
      label: "Market Published",
      description: "Market is live and visible",
      icon: <CircleDot className="h-4 w-4" />,
      timestamp: publishedAt,
    },
    {
      status: "OPEN",
      label: "Betting Open",
      description: "Users can place bets",
      icon: <Clock className="h-4 w-4" />,
      timestamp: opensAt,
    },
    {
      status: "CLOSED",
      label: "Market Closes",
      description: "No more bets accepted",
      icon: <Lock className="h-4 w-4" />,
      timestamp: closesAt,
    },
    {
      status: "RESOLVED",
      label: "Resolution",
      description: "Outcome determined",
      icon: <Trophy className="h-4 w-4" />,
      timestamp: resolvedAt,
    },
    {
      status: "SETTLED",
      label: "Settlement",
      description: "Payouts distributed",
      icon: <Wallet className="h-4 w-4" />,
      timestamp: settledAt,
    },
  ];

  if (currentStatus === "CANCELLED") {
    return (
      <div className={cn("rounded-lg border border-destructive/50 bg-destructive/10 p-4", className)}>
        <div className="flex items-center gap-2 text-destructive">
          <Lock className="h-5 w-5" />
          <span className="font-medium">Market Cancelled</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Timeline
      </h3>
      <div className="relative">
        {steps.map((step, index) => {
          const stepIndex = statusOrder.indexOf(step.status);
          const isCompleted = stepIndex < currentIndex;
          const isCurrent = stepIndex === currentIndex;
          const isPending = stepIndex > currentIndex;

          return (
            <div key={step.status} className="flex gap-4 pb-6 last:pb-0">
              {/* Line and dot */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
                    isCompleted && "border-primary bg-primary text-primary-foreground",
                    isCurrent && "border-primary bg-background text-primary",
                    isPending && "border-muted bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.icon
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 my-1 transition-colors",
                      isCompleted ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <p
                  className={cn(
                    "text-sm font-medium",
                    isCurrent && "text-primary",
                    isPending && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {step.description}
                </p>
                {step.timestamp && (
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    {formatDate(step.timestamp)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
