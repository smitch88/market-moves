"use client";

import Image from "next/image";
import { format } from "date-fns";
import { User, ExternalLink, Lightbulb } from "lucide-react";
import { Button } from "@vault/ui";

export interface ProfileStat {
  label: string;
  value: string | number;
  sublabel?: string;
}

export interface ProfileHeaderCardProps {
  /** Display name for the user */
  displayName: string;
  /** URL for the profile avatar image */
  avatarUrl?: string | null;
  /** Twitter/X handle */
  handle?: string | null;
  /** Whether to show external link for handle */
  showHandleLink?: boolean;
  /** Date when user joined */
  joinedAt?: string | Date | null;
  /** Stats to display in the footer */
  stats: ProfileStat[];
  /** Callback for Request Market button */
  onRequestMarket?: () => void;
}

export function ProfileHeaderCard({
  displayName,
  avatarUrl,
  handle,
  showHandleLink = false,
  joinedAt,
  stats,
  onRequestMarket,
}: ProfileHeaderCardProps) {
  return (
    <div className="border border-border rounded-xl p-5 flex flex-col">
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="relative h-16 w-16 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 via-green-400 to-blue-400 flex-shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={displayName}
              fill
              className="object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <User className="h-8 w-8 text-white/70" />
            </div>
          )}
        </div>

        {/* Name & meta */}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">{displayName}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {handle && (
              <>
                {showHandleLink ? (
                  <a
                    href={`https://x.com/${handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                  >
                    @{handle}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    @{handle}
                  </span>
                )}
                <span className="text-muted-foreground">·</span>
              </>
            )}
            {joinedAt && (
              <span className="text-sm text-muted-foreground">
                Joined{" "}
                {format(
                  typeof joinedAt === "string" ? new Date(joinedAt) : joinedAt,
                  "MMM yyyy"
                )}
              </span>
            )}
          </div>
          
          {/* Request Market Button */}
          {onRequestMarket && (
            <Button
              size="sm"
              onClick={onRequestMarket}
              className="mt-2 gap-2 bg-[#df2421] hover:bg-[#bf1f1c] text-white"
            >
              <Lightbulb className="h-4 w-4" />
              Request Market
            </Button>
          )}
        </div>
      </div>

      {/* Stats row - pushed to bottom */}
      <div className="flex items-center gap-4 sm:gap-6 pt-4 sm:pt-6 mt-4 sm:mt-auto border-t border-border">
        {stats.map((stat, index) => (
          <div key={stat.label} className="flex items-center gap-4 sm:gap-6 flex-shrink-0">
            {index > 0 && <div className="h-8 sm:h-10 w-px bg-border" />}
            <div className="min-w-0">
              <div className="text-lg sm:text-2xl font-bold tabular-nums">{stat.value}</div>
              <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                {stat.label}
                {stat.sublabel && <span className="ml-1">{stat.sublabel}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

