"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// XP & Balance Animation Context
// ============================================================================

interface PendingChange {
  type: "xp" | "balance";
  amount: number;
}

interface XPAnimationContextType {
  // Queue methods (for deferred animation after modal close)
  queueXPGain: (amount: number) => void;
  queueBalanceChange: (amount: number) => void;
  flushQueue: () => void;
  // Active animation state
  activeXPChange: number | null;
  activeBalanceChange: number | null;
  isAnimating: boolean;
  ringPulse: boolean;
  // Clear active changes after animation
  clearActiveXP: () => void;
  clearActiveBalance: () => void;
}

const XPAnimationContext = createContext<XPAnimationContextType | null>(null);

export function useXPAnimation() {
  const context = useContext(XPAnimationContext);
  if (!context) {
    throw new Error("useXPAnimation must be used within XPAnimationProvider");
  }
  return context;
}

interface XPAnimationProviderProps {
  children: React.ReactNode;
}

export function XPAnimationProvider({ children }: XPAnimationProviderProps) {
  const [activeXPChange, setActiveXPChange] = useState<number | null>(null);
  const [activeBalanceChange, setActiveBalanceChange] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [ringPulse, setRingPulse] = useState(false);
  const queueRef = useRef<PendingChange[]>([]);

  // Queue XP gain to be triggered later (e.g., after modal closes)
  const queueXPGain = useCallback((amount: number) => {
    if (amount <= 0) return;
    queueRef.current.push({ type: "xp", amount });
  }, []);

  // Queue balance change to be triggered later
  const queueBalanceChange = useCallback((amount: number) => {
    if (amount === 0) return;
    queueRef.current.push({ type: "balance", amount });
  }, []);

  // Clear active changes
  const clearActiveXP = useCallback(() => {
    setActiveXPChange(null);
  }, []);

  const clearActiveBalance = useCallback(() => {
    setActiveBalanceChange(null);
  }, []);

  // Flush the queue - trigger all pending animations
  const flushQueue = useCallback(() => {
    const queue = queueRef.current;
    queueRef.current = [];
    
    if (queue.length === 0) return;
    
    // Aggregate XP and balance changes
    let totalXP = 0;
    let totalBalance = 0;
    
    queue.forEach(item => {
      if (item.type === "xp") {
        totalXP += item.amount;
      } else {
        totalBalance += item.amount;
      }
    });
    
    // Trigger animations
    setIsAnimating(true);
    setRingPulse(true);
    
    if (totalXP > 0) {
      setActiveXPChange(totalXP);
    }
    if (totalBalance !== 0) {
      setActiveBalanceChange(totalBalance);
    }
    
    // Reset ring pulse after animation
    setTimeout(() => {
      setRingPulse(false);
    }, 1500);
    
    // Reset animating state
    setTimeout(() => {
      setIsAnimating(false);
    }, 2000);
  }, []);

  return (
    <XPAnimationContext.Provider 
      value={{ 
        queueXPGain,
        queueBalanceChange,
        flushQueue,
        activeXPChange,
        activeBalanceChange,
        isAnimating,
        ringPulse,
        clearActiveXP,
        clearActiveBalance,
      }}
    >
      {children}
    </XPAnimationContext.Provider>
  );
}

// ============================================================================
// Animated Number Display with count-up effect
// ============================================================================

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  className?: string;
  duration?: number;
}

export function AnimatedNumber({ value, prefix = "", className = "", duration = 800 }: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (value !== prevValueRef.current) {
      const startValue = prevValueRef.current;
      const diff = value - startValue;
      const startTime = Date.now();

      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        const currentValue = startValue + diff * eased;
        
        setDisplayValue(Math.round(currentValue));
        
        if (progress < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setDisplayValue(value);
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(animate);
      prevValueRef.current = value;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return (
    <span className={className}>
      {prefix}{displayValue.toLocaleString()}
    </span>
  );
}

// ============================================================================
// XP Display with floating change indicator
// ============================================================================

interface AnimatedXPDisplayProps {
  xp: number;
  isLoading?: boolean;
}

export function AnimatedXPDisplay({ xp, isLoading }: AnimatedXPDisplayProps) {
  const { activeXPChange, clearActiveXP } = useXPAnimation();
  const [showChange, setShowChange] = useState(false);
  const [displayedChange, setDisplayedChange] = useState<number | null>(null);

  useEffect(() => {
    if (activeXPChange !== null && activeXPChange > 0) {
      setDisplayedChange(activeXPChange);
      setShowChange(true);
    }
  }, [activeXPChange]);

  if (isLoading) {
    return (
      <span className="text-base font-semibold text-foreground/50 tabular-nums animate-pulse">---</span>
    );
  }

  return (
    <div className="relative">
      <AnimatedNumber 
        value={xp} 
        className="text-base font-semibold text-foreground tabular-nums"
      />
      <AnimatePresence>
        {showChange && displayedChange && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              y: [8, 4, 4, -8],
              scale: [0.8, 1, 1, 0.9],
            }}
            transition={{ 
              duration: 2,
              times: [0, 0.15, 0.7, 1],
              ease: "easeOut",
            }}
            onAnimationComplete={() => {
              setShowChange(false);
              clearActiveXP();
            }}
            className="absolute top-full left-0 right-0 mt-1 whitespace-nowrap pointer-events-none text-center"
          >
            <motion.span
              animate={{
                textShadow: [
                  "0 0 4px rgba(34, 197, 94, 0.8)",
                  "0 0 16px rgba(34, 197, 94, 1)",
                  "0 0 8px rgba(34, 197, 94, 0.9)",
                ],
                scale: [1, 1.15, 1],
              }}
              transition={{ duration: 0.6, repeat: 2, ease: "easeInOut" }}
              className="text-sm font-bold text-[#22C55E] drop-shadow-lg"
            >
              +{displayedChange.toLocaleString()} XP
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Balance Display with floating change indicator
// ============================================================================

interface AnimatedBalanceDisplayProps {
  balance: number;
  isLoading?: boolean;
}

export function AnimatedBalanceDisplay({ balance, isLoading }: AnimatedBalanceDisplayProps) {
  const { activeBalanceChange, clearActiveBalance } = useXPAnimation();
  const [showChange, setShowChange] = useState(false);
  const [displayedChange, setDisplayedChange] = useState<number | null>(null);

  useEffect(() => {
    if (activeBalanceChange !== null && activeBalanceChange !== 0) {
      setDisplayedChange(activeBalanceChange);
      setShowChange(true);
    }
  }, [activeBalanceChange]);

  if (isLoading) {
    return (
      <span className="text-base font-semibold text-[#21C55E]/50 animate-pulse">---</span>
    );
  }

  return (
    <div className="relative">
      <AnimatedNumber 
        value={balance} 
        prefix="$"
        className="text-base font-semibold text-[#21C55E]"
      />
      <AnimatePresence>
        {showChange && displayedChange && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ 
              opacity: [0, 1, 1, 0],
              y: [8, 4, 4, -8],
              scale: [0.8, 1, 1, 0.9],
            }}
            transition={{ 
              duration: 2,
              times: [0, 0.15, 0.7, 1],
              ease: "easeOut",
            }}
            onAnimationComplete={() => {
              setShowChange(false);
              clearActiveBalance();
            }}
            className="absolute top-full left-0 right-0 mt-1 whitespace-nowrap pointer-events-none text-center"
          >
            <motion.span
              animate={{
                textShadow: displayedChange < 0 
                  ? [
                      "0 0 4px rgba(239, 68, 68, 0.8)",
                      "0 0 16px rgba(239, 68, 68, 1)",
                      "0 0 8px rgba(239, 68, 68, 0.9)",
                    ]
                  : [
                      "0 0 4px rgba(34, 197, 94, 0.8)",
                      "0 0 16px rgba(34, 197, 94, 1)",
                      "0 0 8px rgba(34, 197, 94, 0.9)",
                    ],
                scale: [1, 1.15, 1],
              }}
              transition={{ duration: 0.6, repeat: 2, ease: "easeInOut" }}
              className={`text-sm font-bold drop-shadow-lg ${displayedChange < 0 ? "text-red-500" : "text-[#22C55E]"}`}
            >
              {displayedChange < 0 ? "-" : "+"}${Math.abs(displayedChange).toLocaleString()}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Animated XP Progress Ring - Used in profile card
// ============================================================================

interface AnimatedXPRingProps {
  progress: number;
  size?: "sm" | "md" | "lg";
  isAnimating?: boolean;
  children?: React.ReactNode;
}

export function AnimatedXPRing({ 
  progress, 
  size = "md", 
  isAnimating = false,
  children 
}: AnimatedXPRingProps) {
  const { ringPulse } = useXPAnimation();
  const [displayProgress, setDisplayProgress] = useState(progress);
  const [isGlowing, setIsGlowing] = useState(false);
  const prevProgressRef = useRef(progress);

  // Dimensions based on size
  const dimensions = {
    sm: { outer: 36, inner: 28, stroke: 2.5, radius: 16 },
    md: { outer: 48, inner: 36, stroke: 3, radius: 21 },
    lg: { outer: 64, inner: 48, stroke: 3.5, radius: 28 },
  };

  const { outer, inner, stroke, radius } = dimensions[size];
  const circumference = 2 * Math.PI * radius;

  // Animate progress changes
  useEffect(() => {
    if (progress !== prevProgressRef.current) {
      const diff = progress - prevProgressRef.current;
      
      // If progress increased, animate with glow
      if (diff > 0) {
        setIsGlowing(true);
        
        // Animate the progress bar smoothly
        const startProgress = prevProgressRef.current;
        const duration = 1500;
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const t = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplayProgress(startProgress + diff * eased);
          
          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            setDisplayProgress(progress);
            setTimeout(() => setIsGlowing(false), 500);
          }
        };
        
        requestAnimationFrame(animate);
      } else {
        setDisplayProgress(progress);
      }
      
      prevProgressRef.current = progress;
    }
  }, [progress]);

  const shouldPulse = ringPulse || isGlowing || isAnimating;

  return (
    <motion.div 
      className="relative flex items-center justify-center"
      style={{ width: outer, height: outer }}
      animate={ringPulse ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      {/* Glow effect */}
      <AnimatePresence>
        {shouldPulse && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.2 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(223, 36, 33, 0.5) 0%, transparent 70%)",
              filter: "blur(8px)",
            }}
          />
        )}
      </AnimatePresence>

      {/* Progress ring SVG */}
      <svg 
        className="absolute inset-0 -rotate-90" 
        viewBox={`0 0 ${outer} ${outer}`}
        style={{ width: outer, height: outer }}
      >
        {/* Background circle */}
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <motion.circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke="#df2421"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - displayProgress)}
          style={{
            filter: shouldPulse ? "drop-shadow(0 0 8px #df2421)" : "none",
            transition: "filter 0.3s ease",
          }}
        />
      </svg>
      
      {/* Children (avatar) */}
      <div 
        className="relative rounded-full overflow-hidden"
        style={{ width: inner, height: inner }}
      >
        {children}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Hook to watch for XP changes and queue animation
// ============================================================================

export function useXPChangeWatcher(currentXP: number | undefined) {
  const { queueXPGain } = useXPAnimation();
  const prevXPRef = useRef<number | undefined>(undefined);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Skip the first render to avoid triggering on initial load
    if (!initializedRef.current) {
      if (currentXP !== undefined) {
        prevXPRef.current = currentXP;
        initializedRef.current = true;
      }
      return;
    }

    // Check if XP increased
    if (currentXP !== undefined && prevXPRef.current !== undefined) {
      const diff = currentXP - prevXPRef.current;
      if (diff > 0) {
        queueXPGain(diff);
      }
    }
    
    prevXPRef.current = currentXP;
  }, [currentXP, queueXPGain]);
}

// ============================================================================
// Hook to watch for balance changes and queue animation
// ============================================================================

export function useBalanceChangeWatcher(currentBalance: number | undefined) {
  const { queueBalanceChange } = useXPAnimation();
  const prevBalanceRef = useRef<number | undefined>(undefined);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Skip the first render to avoid triggering on initial load
    if (!initializedRef.current) {
      if (currentBalance !== undefined) {
        prevBalanceRef.current = currentBalance;
        initializedRef.current = true;
      }
      return;
    }

    // Check if balance changed
    if (currentBalance !== undefined && prevBalanceRef.current !== undefined) {
      const diff = currentBalance - prevBalanceRef.current;
      // Only show balance changes (negative for bets spent)
      if (diff !== 0) {
        queueBalanceChange(diff);
      }
    }
    
    prevBalanceRef.current = currentBalance;
  }, [currentBalance, queueBalanceChange]);
}
