"use client";

import { forwardRef } from "react";
import type { Market, Event } from "@vault/database";

// Event type that accepts both Date and string for date fields (API serialization)
type FlexibleEvent = Omit<Event, 'createdAt' | 'updatedAt' | 'startTime' | 'endTime'> & {
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  startTime: Date | string | null;
  endTime: Date | string | null;
};

interface BettingTicketProps {
  market: Partial<Market> & { id: string; question?: string };
  event: FlexibleEvent;
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
        className="w-[400px] max-w-full text-white font-sans relative"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          aspectRatio: "4 / 5",
          backgroundImage: "url(/ticket.png)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
        }}
      >
        {/* Content */}
        <div className="absolute inset-0 px-[5%] xs:px-[6%] pt-[2%] xs:pt-[3%] pb-[5%] xs:pb-[6%] flex flex-col justify-between">
            {/* Top section */}
            <div>
              {/* Header - centered */}
              <div className="flex items-center justify-center gap-1.5 xs:gap-2 mb-1.5 xs:mb-2">
                <img src="/logo.svg" alt="Vault Markets" className="w-10 h-10 xs:w-14 xs:h-14" />
                <span className="text-xs xs:text-lg font-medium tracking-wide text-white uppercase">Prediction Receipt</span>
              </div>

              {/* Divider line - gradient fading on edges */}
              <div 
                className="h-[1px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, #FB2C3699 30%, #FB2C3699 70%, transparent 100%)",
                }}
              />
            </div>

            {/* Market Section */}
            <div className="text-center -my-1 xs:-my-2">
              <div className="flex items-center justify-center gap-1 xs:gap-1.5 mb-0.5">
                <div className="w-[5px] h-[5px] xs:w-[6px] xs:h-[6px] rounded-full bg-[#FB2C36]" />
                <span className="text-[10px] xs:text-xs text-[#FB2C36ee] uppercase tracking-wider">Market</span>
              </div>
              <div 
                className="font-medium text-white/80 leading-none whitespace-nowrap overflow-hidden text-ellipsis"
                style={{
                  fontSize: 
                    event.title.length > 70 ? "0.5rem" : 
                    event.title.length > 55 ? "0.6rem" : 
                    event.title.length > 45 ? "0.7rem" : 
                    event.title.length > 35 ? "0.85rem" : 
                    event.title.length > 25 ? "1.1rem" : 
                    "1.5rem",
                }}
              >
                {event.title}
              </div>
              {market.question !== event.title && (
                <div 
                  className="text-white/50 mt-0.5 line-clamp-2"
                  style={{
                    fontSize: (market.question?.length || 0) > 60 ? "0.75rem" : "0.875rem",
                  }}
                >
                  {market.question}
                </div>
              )}
            </div>

            {/* Your Pick Section - gradient left and right */}
            <div 
              className="py-2.5 xs:py-4 -mx-[5%] xs:-mx-[6%] px-[5%] xs:px-[6%] text-center relative overflow-hidden"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(251, 44, 54, 0.15) 30%, rgba(251, 44, 54, 0.2) 70%, transparent 100%)",
              }}
            >
              {/* Top border - gradient */}
              <div 
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(251, 44, 54, 0.5) 30%, rgba(251, 44, 54, 0.5) 70%, transparent 100%)",
                }}
              />
              {/* Subtle glow above bottom border */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-[30px] xs:h-[40px] pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse 50% 100% at 50% 100%, rgba(251, 44, 54, 0.4) 0%, transparent 70%)",
                }}
              />
              {/* Bottom border - gradient */}
              <div 
                className="absolute bottom-0 left-0 right-0 h-[1px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(251, 44, 54, 0.5) 30%, rgba(251, 44, 54, 0.5) 70%, transparent 100%)",
                }}
              />
              <div className="text-xs xs:text-sm text-[#FB2C36] uppercase tracking-wider mb-0.5">Your Pick</div>
              <div className="text-lg xs:text-2xl font-medium text-white/80 leading-tight">{outcomeLabel}</div>
            </div>

            {/* User & Time Info */}
            <div className="flex items-center justify-between -my-1 xs:-my-2">
              <div className="flex items-center gap-1.5 xs:gap-2">
                {userAvatar ? (
                  <img 
                    src={userAvatar} 
                    alt={userName || userHandle || "User"} 
                    className="w-8 h-8 xs:w-10 xs:h-10 rounded-full"
                    style={{ border: "2px solid #FB2C36" }}
                  />
                ) : (
                  <div 
                    className="w-8 h-8 xs:w-10 xs:h-10 rounded-full flex items-center justify-center text-white font-bold text-[10px] xs:text-xs"
                    style={{ 
                      background: "linear-gradient(135deg, #FB2C36 0%, #a01a22 100%)",
                      border: "2px solid #FB2C36",
                    }}
                  >
                    {userName?.[0]?.toUpperCase() || userHandle?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-white text-xs xs:text-sm leading-tight">
                    {userName || userHandle || "Anonymous"}
                  </div>
                  {userHandle && (
                    <div className="text-[10px] xs:text-xs text-white/50 leading-tight">@{userHandle}</div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-white text-xs xs:text-sm font-semibold leading-tight">{formattedDate}</div>
                <div className="text-[10px] xs:text-xs text-white/50 leading-tight">{formattedTime}</div>
              </div>
            </div>

            {/* Wager Section + Divider grouped for glow overflow */}
            <div className="relative">
              {/* Gradient glow - circle behind wager */}
              <div 
                className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  top: "50%",
                  width: "150px",
                  height: "150px",
                  background: "radial-gradient(circle at 50% 50%, rgba(251, 44, 54, 0.23) 0%, transparent 80%)",
                }}
              />
              {/* Top gradient border */}
              <div 
                className="absolute top-0 left-0 right-0 h-[1px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(251, 44, 54, 0.4) 40%, rgba(251, 44, 54, 0.4) 60%, transparent 100%)",
                }}
              />
              <div className="relative pt-2 xs:pt-3 pb-1.5 xs:pb-2 text-center">
                <div className="text-[10px] xs:text-xs text-white/50 uppercase tracking-wider mb-0.5 xs:mb-1">Wager</div>
                <div className="text-2xl xs:text-4xl font-normal text-[#FB2C36] leading-none">
                  ${amount.toLocaleString()}
                </div>
              </div>
              {/* Dashed divider - gradient */}
              <div className="relative h-[1px] mt-1.5 xs:mt-2">
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: "linear-gradient(90deg, transparent 5%, #FB2C36 40%, #FB2C36 60%, transparent 95%)",
                    maskImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, black 4px, black 12px)",
                    WebkitMaskImage: "repeating-linear-gradient(90deg, transparent, transparent 4px, black 4px, black 12px)",
                  }}
                />
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="text-center">
              <div className="text-[10px] xs:text-xs text-white/60 uppercase tracking-wider mb-1 xs:mb-1.5">Make your prediction at</div>
              <div 
                className="inline-block px-3 xs:px-5 py-1.5 xs:py-2 rounded-full text-xs xs:text-sm font-semibold tracking-wide"
                style={{
                  background: "transparent",
                  borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
                  boxShadow: "inset 0 0 8px rgba(251, 44, 54, 0.6), inset 0 0 15px rgba(251, 44, 54, 0.3)",
                }}
              >
                <span className="text-white">PREDICTIONS.</span>
                <span className="text-[#FB2C36]">VAULT777.com</span>
              </div>
            </div>
          </div>
      </div>
    );
  }
);

BettingTicket.displayName = "BettingTicket";
