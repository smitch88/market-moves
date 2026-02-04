"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Button,
  Badge,
  toast,
} from "@vault/ui";
import {
  Loader2,
  Cog,
  RefreshCw,
  Clock,
  Users,
  Timer,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  TrendingUp,
} from "lucide-react";

interface SnapshotStatus {
  lastRefresh: string;
  userCount: number;
  durationMs: number;
  status: "idle" | "running" | "completed" | "failed";
  error: string | null;
}

interface JobConfig {
  id: string;
  name: string;
  description: string;
  schedule: string;
  endpoint: string;
  icon: React.ReactNode;
  statusKey: string;
}

const jobs: JobConfig[] = [
  {
    id: "pnl-snapshot",
    name: "PnL Leaderboard Snapshot",
    description: "Pre-computes total PnL (realized + unrealized) for all users to enable fast leaderboard queries.",
    schedule: "Every 30 minutes",
    endpoint: "/api/admin/jobs/refresh-pnl-snapshot",
    icon: <TrendingUp className="h-5 w-5" />,
    statusKey: "pnl-snapshot",
  },
];

const statusConfig = {
  idle: {
    label: "Idle",
    color: "bg-zinc-500/20 text-zinc-400",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  running: {
    label: "Running",
    color: "bg-blue-500/20 text-blue-400",
    icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  },
  completed: {
    label: "Completed",
    color: "bg-green-500/20 text-green-400",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  failed: {
    label: "Failed",
    color: "bg-red-500/20 text-red-400",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

export default function AdminJobsPage() {
  const queryClient = useQueryClient();

  // Fetch PnL snapshot status
  const { data: pnlSnapshotData, isLoading: pnlSnapshotLoading } = useQuery({
    queryKey: ["adminJobsPnlSnapshot"],
    queryFn: async () => {
      const res = await fetch("/api/admin/jobs/refresh-pnl-snapshot");
      if (!res.ok) throw new Error("Failed to fetch snapshot status");
      return res.json();
    },
    refetchInterval: 10000, // Refresh every 10 seconds to catch status updates
  });

  // Mutation to trigger PnL snapshot refresh
  const refreshPnlSnapshotMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/jobs/refresh-pnl-snapshot", {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to trigger refresh");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["adminJobsPnlSnapshot"] });
      toast.success(`Snapshot refreshed! ${data.userCount} users processed in ${data.durationMs}ms`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const pnlSnapshot: SnapshotStatus | null = pnlSnapshotData?.snapshot || null;

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <Cog className="h-7 w-7 text-primary" />
          Background Jobs
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Monitor and manually trigger scheduled background jobs
        </p>
      </div>

      {/* Info Banner */}
      <GlassCard variant="solid">
        <GlassCardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="text-muted-foreground">
                Background jobs are automatically run on a schedule via Vercel Cron. 
                Use the manual trigger buttons below to run jobs immediately if needed.
              </p>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Jobs List */}
      <div className="space-y-4">
        {jobs.map((job) => {
          const isLoading = job.id === "pnl-snapshot" && pnlSnapshotLoading;
          const snapshot = job.id === "pnl-snapshot" ? pnlSnapshot : null;
          const isRunning = job.id === "pnl-snapshot" && refreshPnlSnapshotMutation.isPending;
          const status = snapshot?.status || "idle";
          const statusInfo = statusConfig[status as keyof typeof statusConfig] || statusConfig.idle;

          return (
            <GlassCard key={job.id} variant="solid">
              <GlassCardHeader className="pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      {job.icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{job.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">{job.description}</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (job.id === "pnl-snapshot") {
                        refreshPnlSnapshotMutation.mutate();
                      }
                    }}
                    disabled={isRunning || status === "running"}
                    className="flex-shrink-0"
                  >
                    {isRunning || status === "running" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Run Now
                      </>
                    )}
                  </Button>
                </div>
              </GlassCardHeader>
              <GlassCardContent className="pt-4">
                {isLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Loading status...</span>
                  </div>
                ) : snapshot ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {/* Status */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium ${statusInfo.color}`}>
                        {statusInfo.icon}
                        {statusInfo.label}
                      </div>
                    </div>

                    {/* Last Run */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Last Run</p>
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">
                          {formatDistanceToNow(new Date(snapshot.lastRefresh), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(snapshot.lastRefresh), "MMM d, yyyy HH:mm:ss")}
                      </p>
                    </div>

                    {/* Users Processed */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Users</p>
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{snapshot.userCount.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                      <div className="flex items-center gap-1.5">
                        <Timer className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{formatDuration(snapshot.durationMs)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    No snapshot data available. Run the job to create the initial snapshot.
                  </div>
                )}

                {/* Error Display */}
                {snapshot?.error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-red-400">Last run failed</p>
                        <p className="text-xs text-red-400/80 mt-1">{snapshot.error}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Schedule Info */}
                <div className="mt-4 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4" />
                    <span>Scheduled: <strong>{job.schedule}</strong></span>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          );
        })}
      </div>

      {/* Future Jobs Placeholder */}
      <GlassCard variant="solid">
        <GlassCardContent className="p-6 text-center">
          <div className="text-muted-foreground">
            <Cog className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">More scheduled jobs can be added here as needed.</p>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
