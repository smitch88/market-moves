"use client";

import { forwardRef } from "react";
import type { Market, Event } from "@vault/database";

interface BettingTicketProps {
  market: Market;
  event: Event;
  outcomeLabel: string;
  outcomeIndex: number; 
  amount: number;
  userName?: string | null;
  userHandle?: string | null;
  userAvatar?: string | null;
  timestamp?: Date;
}

export const BettingTicket = forwardRef<HTMLDivElement, BettingTicketProps>(
  ({ market, event, outcomeLabel, outcomeIndex, amount, userName, userHandle, userAvatar, timestamp = new Date() }, ref) => {
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
        className="w-full max-w-[400px] bg-black text-white font-sans overflow-hidden border border-white/10 rounded-sm"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        {/* Top decorative edge */}
        <div className="h-3 sm:h-4 bg-[#df2421] relative">
          <div className="absolute bottom-0 left-0 right-0 h-2 flex justify-between px-1">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="w-2 h-2 sm:w-3 sm:h-3 bg-black rounded-full -mb-1 sm:-mb-1.5" />
            ))}
          </div>
        </div>

        {/* Header */}
        <div className="px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 text-center border-b border-dashed border-white/15">
          <div className="flex items-center justify-center gap-2 mb-1 sm:mb-2">
            <img src="/logo.svg" alt="Vault Markets" className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-base sm:text-lg font-bold tracking-wider text-white">VAULT777</span>
          </div>
          <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-widest">Prediction Receipt</div>
        </div>

        {/* Market Info */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4">
          {/* Market Title */}
          <div className="text-center">
            <div className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wide mb-1">Market</div>
            <div className="text-base sm:text-lg font-semibold leading-tight">{event.title}</div>
            {market.question !== event.title && (
              <div className="text-xs sm:text-sm text-white/70 mt-1">{market.question}</div>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 border-t border-white/10" />
            <div className="text-[10px] sm:text-xs text-white/30">★</div>
            <div className="flex-1 border-t border-white/10" />
          </div>

          {/* Prediction */}
          <div className="space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex-1 text-center">
                <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider mb-1 sm:mb-2">Your Pick</div>
                <div className="text-2xl sm:text-3xl font-bold text-white leading-tight">
                  {outcomeLabel}
                </div>
              </div>
            </div>

            {/* Amount */}
            <div className="flex items-center justify-between pt-3 sm:pt-4 border-t border-white/5">
              <div className="text-[10px] sm:text-xs text-white/40 uppercase tracking-wider">Wager</div>
              <div className="text-2xl sm:text-3xl font-bold text-[#df2421] tracking-tight">
                ${amount.toLocaleString()}
              </div>
            </div>
          </div>

          {/* User & Time Info */}
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              {userAvatar ? (
                <img src={userAvatar} alt={userName || userHandle || "User"} className="w-6 h-6 sm:w-8 sm:h-8 rounded-full" />
              ) : (
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-[#df2421] flex items-center justify-center text-white font-bold text-[10px] sm:text-xs">
                  {userName?.[0]?.toUpperCase() || userHandle?.[0]?.toUpperCase() || "?"}
                </div>
              )}
              <div>
                <div className="font-medium text-white/90 text-xs sm:text-sm">
                  {userName || userHandle || "Anonymous"}
                </div>
                {userHandle && userName && (
                  <div className="text-[10px] sm:text-xs text-white/50">@{userHandle}</div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white/90 text-xs sm:text-sm">{formattedDate}</div>
              <div className="text-[10px] sm:text-xs text-white/50">{formattedTime}</div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-[#df2421]/10 border-t border-white/10">
          <div className="flex items-center justify-between">
            <div className="text-[10px] sm:text-xs text-white/60">
              Make your prediction at
            </div>
            <div className="text-xs sm:text-sm font-semibold text-[#df2421]">
              predictions.vault777.com
            </div>
          </div>
        </div>

        {/* Bottom decorative edge */}
        <div className="h-3 sm:h-4 bg-[#df2421] relative">
          <div className="absolute top-0 left-0 right-0 h-2 flex justify-between px-1">
            {[...Array(16)].map((_, i) => (
              <div key={i} className="w-2 h-2 sm:w-3 sm:h-3 bg-black rounded-full -mt-1 sm:-mt-1.5" />
            ))}
          </div>
        </div>
      </div>
    );
  }
);

BettingTicket.displayName = "BettingTicket";
