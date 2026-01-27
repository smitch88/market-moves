"use client";

import { forwardRef } from "react";
import type { Market, Outcome } from "@vault/database";

interface BettingTicketProps {
  market: Market & { outcomes: Outcome[] };
  outcome: Outcome;
  amount: number;
  userName?: string | null;
  userHandle?: string | null;
  userAvatar?: string | null;
  timestamp?: Date;
}

export const BettingTicket = forwardRef<HTMLDivElement, BettingTicketProps>(
  ({ market, outcome, amount, userName, userHandle, timestamp = new Date() }, ref) => {
    const formattedDate = timestamp.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const formattedTime = timestamp.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return (
      <div
        ref={ref}
        className="w-[400px] bg-[#0a0a0f] text-white font-sans overflow-hidden"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Top decorative edge */}
        <div className="h-4 bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 relative">
          <div className="absolute bottom-0 left-0 right-0 h-2 flex justify-between px-1">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="w-3 h-3 bg-[#0a0a0f] rounded-full -mb-1.5" />
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="px-6 pt-6 pb-4 text-center border-b border-dashed border-white/20">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-purple-400" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="text-lg font-bold tracking-wider text-purple-400">VAULT MARKETS</span>
          </div>
          <div className="text-xs text-white/50 uppercase tracking-widest">Prediction Receipt</div>
        </div>

        {/* Market Info */}
        <div className="px-6 py-5 space-y-4">
          {/* Market Title */}
          <div className="text-center">
            <div className="text-xs text-white/50 uppercase tracking-wide mb-1">Market</div>
            <div className="text-lg font-semibold leading-tight">{market.title}</div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 border-t border-white/10" />
            <div className="text-xs text-white/30">★</div>
            <div className="flex-1 border-t border-white/10" />
          </div>

          {/* Prediction */}
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 text-center">
                <div className="text-xs text-white/40 uppercase tracking-wider mb-2">Your Pick</div>
                <div className="text-3xl font-bold text-purple-300 leading-tight">
                  {outcome.label}
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div className="text-xs text-white/40 uppercase tracking-wider">Wager</div>
              <div className="text-3xl font-bold text-[#df2421] tracking-tight">
                ${amount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* User & Time Info */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs">
                {userName?.[0]?.toUpperCase() || userHandle?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <div className="font-medium text-white/90">
                  {userName || userHandle || "Anonymous"}
                </div>
                {userHandle && userName && (
                  <div className="text-xs text-white/50">@{userHandle}</div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white/90">{formattedDate}</div>
              <div className="text-xs text-white/50">{formattedTime}</div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="text-xs text-white/70">
              Make your prediction at
            </div>
            <div className="text-sm font-semibold text-purple-300">
              vault777.com
            </div>
          </div>
        </div>

        {/* Bottom decorative edge */}
        <div className="h-4 bg-gradient-to-r from-purple-600 via-purple-500 to-purple-600 relative">
          <div className="absolute top-0 left-0 right-0 h-2 flex justify-between px-1">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="w-3 h-3 bg-[#0a0a0f] rounded-full -mt-1.5" />
            ))}
          </div>
        </div>
      </div>
    );
  }
);

BettingTicket.displayName = "BettingTicket";
