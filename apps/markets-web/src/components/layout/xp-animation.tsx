"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";

// ============================================================================
// XP Animation Context
// ============================================================================

interface XPAnimationContextType {
  triggerXPGain: (amount: number) => void;
  isAnimating: boolean;
  lastXPGain: number | null;
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
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastXPGain, setLastXPGain] = useState<number | null>(null);
  const [showFloater, setShowFloater] = useState(false);

  const triggerXPGain = useCallback((amount: number) => {
    setLastXPGain(amount);
    setIsAnimating(true);
    setShowFloater(true);
    
    // Reset animation state after animation completes
    setTimeout(() => {
      setIsAnimating(false);
    }, 2000);
    
    // Hide floater after it animates out
    setTimeout(() => {
      setShowFloater(false);
    }, 2500);
  }, []);

  return (
    <XPAnimationContext.Provider value={{ triggerXPGain, isAnimating, lastXPGain }}>
      {children}
      {/* Global XP Floater */}
      <XPFloater amount={lastXPGain} show={showFloater} />
    </XPAnimationContext.Provider>
  );
}

// ============================================================================
// XP Floater Component - Shows "+XP" floating up
// ============================================================================

interface XPFloaterProps {
  amount: number | null;
  show: boolean;
}

function XPFloater({ amount, show }: XPFloaterProps) {
  if (amount === null) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -40, scale: 0.9 }}
          transition={{ duration: 0.5 }}
          className="fixed top-20 right-4 z-[100] pointer-events-none"
        >
          <motion.div
            animate={{ 
              y: [0, -8, 0],
            }}
            transition={{ 
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/90 to-yellow-500/90 shadow-lg shadow-amber-500/30"
          >
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
            <span className="text-lg font-bold text-white">
              +{amount.toLocaleString()} XP
            </span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
        const duration = 1500; // 1.5 seconds
        const startTime = Date.now();
        
        const animate = () => {
          const elapsed = Date.now() - startTime;
          const t = Math.min(elapsed / duration, 1);
          // Ease out cubic
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplayProgress(startProgress + diff * eased);
          
          if (t < 1) {
            requestAnimationFrame(animate);
          } else {
            setDisplayProgress(progress);
            // Keep glow for a bit after animation
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

  return (
    <div 
      className="relative flex items-center justify-center"
      style={{ width: outer, height: outer }}
    >
      {/* Glow effect */}
      <AnimatePresence>
        {(isGlowing || isAnimating) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1.1 }}
            exit={{ opacity: 0, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(223, 36, 33, 0.4) 0%, transparent 70%)",
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
            filter: isGlowing || isAnimating ? "drop-shadow(0 0 6px #df2421)" : "none",
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
    </div>
  );
}

// ============================================================================
// Hook to watch for XP changes and trigger animation
// ============================================================================

export function useXPChangeWatcher(currentXP: number | undefined) {
  const { triggerXPGain } = useXPAnimation();
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
        triggerXPGain(diff);
      }
    }
    
    prevXPRef.current = currentXP;
  }, [currentXP, triggerXPGain]);
}
