"use client";

import { forwardRef, useState } from "react";
import { Trophy } from "lucide-react";

interface WinningTicketProps {
  eventTitle: string;
  marketQuestion?: string;
  outcomeLabel: string;
  /** Amount wagered */
  wager: number;
  /** Amount won (payout - wager) */
  profit: number;
  /** Total payout */
  payout: number;
  /** Profit percentage */
  profitPercent: number;
  userName?: string | null;
  userHandle?: string | null;
  userAvatar?: string | null;
  settledDate?: Date;
}

export const WinningTicket = forwardRef<HTMLDivElement, WinningTicketProps>(
  (
    {
      eventTitle,
      marketQuestion,
      outcomeLabel,
      wager,
      profit,
      payout,
      profitPercent,
      userName,
      userHandle,
      userAvatar,
      settledDate = new Date(),
    },
    ref
  ) => {
    const [avatarError, setAvatarError] = useState(false);
    const formattedDate = settledDate.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    return (
      <div
        ref={ref}
        className="w-[400px] max-w-full text-white font-sans relative"
        style={{
          fontFamily: "'Inter', system-ui, sans-serif",
          aspectRatio: "4 / 5",
          backgroundImage: "url(/ticket-win.png)",
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundColor: "#000",
        }}
      >
        {/* Fallback gradient background if image not found */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            background:
              "linear-gradient(145deg, #0a0a0a 0%, #111 50%, #0a0a0a 100%)",
            border: "2px solid #22c55e33",
            boxShadow: "inset 0 0 60px rgba(34, 197, 94, 0.1)",
            zIndex: -1,
          }}
        />

        {/* Content */}
        <div className="absolute inset-0 px-[5%] xs:px-[6%] pt-[2%] xs:pt-[3%] pb-[5%] xs:pb-[6%] flex flex-col justify-between">
          {/* Top section */}
          <div>
            {/* Header - centered with trophy */}
            <div className="flex items-center justify-center gap-1.5 xs:gap-2 mb-1.5 xs:mb-2">
              <img
                src="/logo.svg"
                alt="Vault Markets"
                className="w-10 h-10 xs:w-14 xs:h-14"
              />
              <div className="flex items-center gap-1.5">
                <Trophy className="w-4 h-4 xs:w-5 xs:h-5 text-[#22c55e]" />
                <span className="text-xs xs:text-lg font-medium tracking-wide text-[#22c55e] uppercase">
                  Winner
                </span>
              </div>
            </div>

            {/* Divider line - green gradient */}
            <div
              className="h-[1px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, #22c55e99 30%, #22c55e99 70%, transparent 100%)",
              }}
            />
          </div>

          {/* Market Section */}
          <div className="text-center -my-1 xs:-my-2">
            <div className="flex items-center justify-center gap-1 xs:gap-1.5 mb-0.5">
              <div className="w-[5px] h-[5px] xs:w-[6px] xs:h-[6px] rounded-full bg-[#22c55e]" />
              <span className="text-[10px] xs:text-xs text-[#22c55eee] uppercase tracking-wider">
                Market
              </span>
            </div>
            <div
              className="font-medium text-white/80 leading-none whitespace-nowrap overflow-hidden text-ellipsis"
              style={{
                fontSize:
                  eventTitle.length > 70
                    ? "0.5rem"
                    : eventTitle.length > 55
                      ? "0.6rem"
                      : eventTitle.length > 45
                        ? "0.7rem"
                        : eventTitle.length > 35
                          ? "0.85rem"
                          : eventTitle.length > 25
                            ? "1.1rem"
                            : "1.5rem",
              }}
            >
              {eventTitle}
            </div>
            {marketQuestion && marketQuestion !== eventTitle && (
              <div
                className="text-white/50 mt-0.5 line-clamp-2"
                style={{
                  fontSize: marketQuestion.length > 60 ? "0.75rem" : "0.875rem",
                }}
              >
                {marketQuestion}
              </div>
            )}
          </div>

          {/* Winning Pick Section - green gradient */}
          <div
            className="py-2.5 xs:py-4 -mx-[5%] xs:-mx-[6%] px-[5%] xs:px-[6%] text-center relative overflow-hidden"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(34, 197, 94, 0.15) 30%, rgba(34, 197, 94, 0.2) 70%, transparent 100%)",
            }}
          >
            {/* Top border - gradient */}
            <div
              className="absolute top-0 left-0 right-0 h-[1px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(34, 197, 94, 0.5) 30%, rgba(34, 197, 94, 0.5) 70%, transparent 100%)",
              }}
            />
            {/* Subtle glow above bottom border */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[30px] xs:h-[40px] pointer-events-none"
              style={{
                background:
                  "radial-gradient(ellipse 50% 100% at 50% 100%, rgba(34, 197, 94, 0.4) 0%, transparent 70%)",
              }}
            />
            {/* Bottom border - gradient */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[1px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(34, 197, 94, 0.5) 30%, rgba(34, 197, 94, 0.5) 70%, transparent 100%)",
              }}
            />
            <div className="text-xs xs:text-sm text-[#22c55e] uppercase tracking-wider mb-0.5">
              Winning Pick
            </div>
            <div className="text-lg xs:text-2xl font-medium text-white/80 leading-tight">
              {outcomeLabel}
            </div>
          </div>

          {/* User & Date Info */}
          <div className="flex items-center justify-between -my-1 xs:-my-2">
            <div className="flex items-center gap-1.5 xs:gap-2">
              {userAvatar && !avatarError ? (
                <img
                  src={userAvatar}
                  alt={userName || userHandle || "User"}
                  className="w-8 h-8 xs:w-10 xs:h-10 rounded-full"
                  style={{ border: "2px solid #22c55e" }}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <div
                  className="w-8 h-8 xs:w-10 xs:h-10 rounded-full flex items-center justify-center text-white font-bold text-[10px] xs:text-xs"
                  style={{
                    background:
                      "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                    border: "2px solid #22c55e",
                  }}
                >
                  {userName?.[0]?.toUpperCase() ||
                    userHandle?.[0]?.toUpperCase() ||
                    "?"}
                </div>
              )}
              <div>
                <div className="font-semibold text-white text-xs xs:text-sm leading-tight">
                  {userName || userHandle || "Anonymous"}
                </div>
                {userHandle && (
                  <div className="text-[10px] xs:text-xs text-white/50 leading-tight">
                    @{userHandle}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-white text-xs xs:text-sm font-semibold leading-tight">
                {formattedDate}
              </div>
              <div className="text-[10px] xs:text-xs text-white/50 leading-tight">
                Settled
              </div>
            </div>
          </div>

          {/* Profit Section */}
          <div className="relative">
            {/* Gradient glow - circle behind profit */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                top: "50%",
                width: "150px",
                height: "150px",
                background:
                  "radial-gradient(circle at 50% 50%, rgba(34, 197, 94, 0.23) 0%, transparent 80%)",
              }}
            />
            {/* Top gradient border */}
            <div
              className="absolute top-0 left-0 right-0 h-[1px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(34, 197, 94, 0.4) 40%, rgba(34, 197, 94, 0.4) 60%, transparent 100%)",
              }}
            />
            <div className="relative pt-2 xs:pt-3 pb-1.5 xs:pb-2 text-center">
              <div className="text-[10px] xs:text-xs text-white/50 uppercase tracking-wider mb-0.5 xs:mb-1">
                Profit
              </div>
              <div className="text-2xl xs:text-4xl font-bold text-[#22c55e] leading-none">
                +${profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm xs:text-base text-[#22c55e]/70 mt-0.5">
                +{profitPercent.toFixed(0)}% ROI
              </div>
            </div>
            {/* Stats row */}
            <div className="flex justify-center gap-6 text-xs xs:text-sm text-white/60 mt-1">
              <div>
                <span className="text-white/40">Wager:</span>{" "}
                <span className="tabular-nums">${wager.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-white/40">Payout:</span>{" "}
                <span className="tabular-nums text-[#22c55e]">
                  ${payout.toFixed(2)}
                </span>
              </div>
            </div>
            {/* Dashed divider - gradient */}
            <div className="relative h-[1px] mt-1.5 xs:mt-2">
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, transparent 5%, #22c55e 40%, #22c55e 60%, transparent 95%)",
                  maskImage:
                    "repeating-linear-gradient(90deg, transparent, transparent 4px, black 4px, black 12px)",
                  WebkitMaskImage:
                    "repeating-linear-gradient(90deg, transparent, transparent 4px, black 4px, black 12px)",
                }}
              />
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="text-center">
            <div className="text-[10px] xs:text-xs text-white/60 uppercase tracking-wider mb-1 xs:mb-1.5">
              Make your prediction at
            </div>
            <div
              className="inline-block px-3 xs:px-5 py-1.5 xs:py-2 rounded-full text-xs xs:text-sm font-semibold tracking-wide"
              style={{
                background: "transparent",
                borderBottom: "1px solid rgba(255, 255, 255, 0.3)",
                boxShadow:
                  "inset 0 0 8px rgba(34, 197, 94, 0.6), inset 0 0 15px rgba(34, 197, 94, 0.3)",
              }}
            >
              <span className="text-white">MARKETS.</span>
              <span className="text-[#22c55e]">VAULT777.com</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

WinningTicket.displayName = "WinningTicket";
