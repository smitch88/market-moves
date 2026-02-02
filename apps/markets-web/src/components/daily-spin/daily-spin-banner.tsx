"use client";

import { useState, useEffect } from "react";
import { Gift, Clock, ChevronRight } from "lucide-react";
import { DailySpinWheel } from "./daily-spin-wheel";

interface DailySpinBannerProps {
  onBalanceUpdate?: (newBalance: number) => void;
  className?: string;
}

export function DailySpinBanner({ onBalanceUpdate, className = "" }: DailySpinBannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [canSpin, setCanSpin] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState("");
  const [nextSpinAt, setNextSpinAt] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    checkSpinStatus();
  }, []);

  // Update countdown
  useEffect(() => {
    if (!nextSpinAt) return;
    
    const updateCountdown = () => {
      const next = new Date(nextSpinAt);
      const now = new Date();
      const diff = next.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdown("");
        setCanSpin(true);
        return;
      }
      
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      if (hours > 0) {
        setCountdown(`${hours}h ${minutes}m`);
      } else {
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setCountdown(`${minutes}m ${seconds}s`);
      }
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextSpinAt]);

  async function checkSpinStatus() {
    try {
      const res = await fetch("/api/me/daily-spin");
      if (res.ok) {
        const data = await res.json();
        setCanSpin(data.canSpin);
        setNextSpinAt(data.nextSpinAt || null);
      }
    } catch (error) {
      console.error("Failed to check spin status:", error);
    }
  }

  const handleClose = () => {
    setIsOpen(false);
    checkSpinStatus();
  };

  if (canSpin === null) return null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
          group relative w-full overflow-hidden rounded-xl
          transition-all duration-300 text-left
          ${canSpin 
            ? "bg-gradient-to-r from-[#FB2C36]/10 via-[#FB2C36]/5 to-[#FB2C36]/10 border border-[#FB2C36]/20 hover:border-[#FB2C36]/40 hover:from-[#FB2C36]/15 hover:via-[#FB2C36]/10 hover:to-[#FB2C36]/15" 
            : "bg-gradient-to-r from-white/[0.02] via-white/[0.01] to-white/[0.02] border border-white/5 hover:border-white/10"
          }
          ${className}
        `}
      >
        {/* Animated glow for available spin */}
        {canSpin && (
          <>
            <div 
              className="absolute inset-0 transition-opacity duration-500"
              style={{
                background: `radial-gradient(ellipse at ${isHovered ? "50%" : "20%"} 50%, rgba(251, 44, 54, 0.15) 0%, transparent 60%)`,
                opacity: isHovered ? 1 : 0.7,
              }}
            />
            {/* Shimmer */}
            <div 
              className="absolute inset-0 -translate-x-full animate-[shimmer_4s_ease-in-out_infinite]"
              style={{
                background: "linear-gradient(90deg, transparent 0%, rgba(251, 44, 54, 0.1) 50%, transparent 100%)",
              }}
            />
          </>
        )}
        
        <div className="relative flex items-center justify-between px-4 py-3.5">
          {/* Left side */}
          <div className="flex items-center gap-3">
            <div 
              className={`
                relative flex items-center justify-center w-11 h-11 rounded-xl
                transition-all duration-300
                ${canSpin 
                  ? "bg-[#FB2C36]/20 border border-[#FB2C36]/30" 
                  : "bg-white/5 border border-white/10"
                }
              `}
            >
              {canSpin ? (
                <Gift className="w-5 h-5 text-[#FB2C36]" />
              ) : (
                <Clock className="w-5 h-5 text-white/30" />
              )}
              
              {/* Pulse for available */}
              {canSpin && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FB2C36] opacity-60" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-[#FB2C36] border-2 border-[#0a0a0a]" />
                </span>
              )}
            </div>
            
            <div>
              <div className={`text-sm font-semibold tracking-wide ${canSpin ? "text-white" : "text-white/50"}`}>
                {canSpin ? "Daily Spin Ready!" : "Daily Spin"}
              </div>
              <div className="text-xs text-white/30">
                {canSpin ? (
                  <span className="text-[#FB2C36]/80">Win up to $20,000</span>
                ) : (
                  <span>Next spin in {countdown || "..."}</span>
                )}
              </div>
            </div>
          </div>
          
          {/* Right side */}
          <div className="flex items-center gap-2">
            {canSpin && (
              <span 
                className="hidden xs:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, #FB2C36 0%, #d91e28 100%)",
                  boxShadow: "0 2px 8px rgba(251, 44, 54, 0.3)",
                }}
              >
                <Gift className="w-3 h-3" />
                SPIN
              </span>
            )}
            <ChevronRight 
              className={`
                w-5 h-5 transition-all duration-200 
                ${canSpin ? "text-[#FB2C36]" : "text-white/20"} 
                group-hover:translate-x-0.5
              `} 
            />
          </div>
        </div>
      </button>

      <DailySpinWheel 
        isOpen={isOpen} 
        onClose={handleClose}
        onBalanceUpdate={onBalanceUpdate}
      />
    </>
  );
}
