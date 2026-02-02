"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "@vault/ui";
import { Clock, X } from "lucide-react";
import { useTheme } from "next-themes";

interface SpinReward {
  amount: number;
  label: string;
  tier: string;
  color: string;
}

interface SpinStatus {
  canSpin: boolean;
  nextSpinAt?: string;
  todayReward?: number;
}

// Wheel segments - colors for dark and light mode
const WHEEL_SEGMENTS_DARK = [
  { amount: 500,   label: "$500",   color: "#18181b", textColor: "#a1a1aa" },
  { amount: 5000,  label: "$5K",    color: "#1c1c1e", textColor: "#FB2C36" },
  { amount: 750,   label: "$750",   color: "#18181b", textColor: "#a1a1aa" },
  { amount: 10000, label: "$10K",   color: "#1c1c1e", textColor: "#fbbf24" },
  { amount: 1000,  label: "$1K",    color: "#18181b", textColor: "#d4d4d8" },
  { amount: 3000,  label: "$3K",    color: "#1c1c1e", textColor: "#fafafa" },
  { amount: 1500,  label: "$1.5K",  color: "#18181b", textColor: "#d4d4d8" },
  { amount: 20000, label: "$20K",   color: "#7f1d1d", textColor: "#fef3c7" },
  { amount: 2000,  label: "$2K",    color: "#18181b", textColor: "#e4e4e7" },
  { amount: 7500,  label: "$7.5K",  color: "#1c1c1e", textColor: "#FB2C36" },
];

// Light mode - rich cream/charcoal alternating with accent colors
const WHEEL_SEGMENTS_LIGHT = [
  { amount: 500,   label: "$500",   color: "#1c1917", textColor: "#a8a29e" },  // stone-900
  { amount: 5000,  label: "$5K",    color: "#fafaf9", textColor: "#dc2626" },  // stone-50 + red
  { amount: 750,   label: "$750",   color: "#1c1917", textColor: "#a8a29e" },  // stone-900
  { amount: 10000, label: "$10K",   color: "#fafaf9", textColor: "#b45309" },  // stone-50 + amber
  { amount: 1000,  label: "$1K",    color: "#1c1917", textColor: "#d6d3d1" },  // stone-900
  { amount: 3000,  label: "$3K",    color: "#fafaf9", textColor: "#18181b" },  // stone-50 + black
  { amount: 1500,  label: "$1.5K",  color: "#1c1917", textColor: "#d6d3d1" },  // stone-900
  { amount: 20000, label: "$20K",   color: "#b91c1c", textColor: "#fef2f2" },  // red-700 + cream (JACKPOT)
  { amount: 2000,  label: "$2K",    color: "#1c1917", textColor: "#e7e5e4" },  // stone-900
  { amount: 7500,  label: "$7.5K",  color: "#fafaf9", textColor: "#dc2626" },  // stone-50 + red
];

const NUM_SEGMENTS = WHEEL_SEGMENTS_DARK.length;
const SEGMENT_ANGLE = 360 / NUM_SEGMENTS;

export function DailySpinWheel({ 
  isOpen, 
  onClose,
  onBalanceUpdate,
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onBalanceUpdate?: (newBalance: number) => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const WHEEL_SEGMENTS = isDark ? WHEEL_SEGMENTS_DARK : WHEEL_SEGMENTS_LIGHT;
  
  const [spinStatus, setSpinStatus] = useState<SpinStatus | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinReward | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [countdown, setCountdown] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastSegmentRef = useRef<number>(-1);

  useEffect(() => {
    if (isOpen) fetchSpinStatus();
  }, [isOpen]);

  useEffect(() => {
    if (!spinStatus?.nextSpinAt) return;
    const updateCountdown = () => {
      const next = new Date(spinStatus.nextSpinAt!);
      const diff = next.getTime() - Date.now();
      if (diff <= 0) { setCountdown(""); fetchSpinStatus(); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [spinStatus?.nextSpinAt]);

  const playTick = useCallback((vol: number) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 500 + Math.random() * 150;
      osc.type = "sine";
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.04);
    } catch {}
  }, []);

  const getCurrentSegment = useCallback((rot: number) => {
    const n = ((rot % 360) + 360) % 360;
    return Math.floor((360 - n) % 360 / SEGMENT_ANGLE) % NUM_SEGMENTS;
  }, []);

  const drawWheel = useCallback((rot: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const size = 280;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 12;
    const seg = (2 * Math.PI) / NUM_SEGMENTS;

    ctx.clearRect(0, 0, size, size);

    // Outer glow/shadow for light mode
    if (!isDark) {
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = "#fafaf9";
      ctx.fill();
      ctx.restore();
    }

    // Outer ring - thicker and more visible
    ctx.beginPath();
    ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.08)" : "#1c1917";
    ctx.lineWidth = isDark ? 1 : 3;
    ctx.stroke();

    // Segments
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rot * Math.PI) / 180);

    WHEEL_SEGMENTS.forEach((s, i) => {
      const start = i * seg - Math.PI / 2;
      const end = start + seg;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, start, end);
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      
      // Segment dividers
      ctx.strokeStyle = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.12)";
      ctx.lineWidth = isDark ? 1 : 1.5;
      ctx.stroke();

      // Text
      ctx.save();
      ctx.rotate(start + seg / 2 + Math.PI / 2);
      ctx.translate(0, -r * 0.65);
      ctx.fillStyle = s.textColor;
      ctx.font = `700 ${s.amount >= 1000 ? 14 : 13}px system-ui, -apple-system, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(s.label, 0, 0);
      ctx.restore();
    });

    ctx.restore();

    // Pegs on wheel edge (skip top one where pointer is)
    for (let i = 0; i < NUM_SEGMENTS; i++) {
      if (i === 0) continue;
      const angle = (i * seg) - Math.PI / 2;
      const px = cx + r * Math.cos(angle);
      const py = cy + r * Math.sin(angle);
      
      // Peg shadow in light mode
      if (!isDark) {
        ctx.beginPath();
        ctx.arc(px + 1, py + 1, 4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.fill();
      }
      
      ctx.beginPath();
      ctx.arc(px, py, isDark ? 3 : 4, 0, Math.PI * 2);
      ctx.fillStyle = "#dc2626";
      ctx.fill();
      
      // Highlight on pegs
      ctx.beginPath();
      ctx.arc(px - 1, py - 1, isDark ? 1 : 1.5, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.fill();
    }

    // Center hub with gradient
    const hubGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.18);
    if (isDark) {
      hubGradient.addColorStop(0, "#27272a");
      hubGradient.addColorStop(1, "#09090b");
    } else {
      hubGradient.addColorStop(0, "#fafaf9");
      hubGradient.addColorStop(1, "#e7e5e4");
    }
    
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = hubGradient;
    ctx.fill();
    ctx.strokeStyle = isDark ? "rgba(255,255,255,0.15)" : "#1c1917";
    ctx.lineWidth = isDark ? 2 : 2.5;
    ctx.stroke();

  }, [isDark, WHEEL_SEGMENTS]);

  useEffect(() => {
    if (isOpen) drawWheel(rotation);
  }, [isOpen, drawWheel, rotation, isDark]);

  // Helper to format amount as label
  const formatRewardLabel = (amount: number): string => {
    if (amount >= 1000) return `$${(amount / 1000).toLocaleString()}K`;
    return `$${amount.toLocaleString()}`;
  };

  async function fetchSpinStatus() {
    try {
      const res = await fetch("/api/me/daily-spin");
      if (res.ok) {
        const data = await res.json();
        setSpinStatus(data);
        
        // If user already spun today, show their result
        if (!data.canSpin && data.todayReward !== undefined) {
          setResult({
            amount: data.todayReward,
            label: formatRewardLabel(data.todayReward),
            tier: data.todayReward >= 5000 ? "jackpot" : "normal",
            color: "#10B981",
          });
          setShowResult(true);
        } else {
          // Reset result state when they can spin again
          setResult(null);
          setShowResult(false);
        }
      }
    } catch (e) { console.error(e); }
  }

  async function handleSpin() {
    if (isSpinning || !spinStatus?.canSpin) return;
    setIsSpinning(true);
    setShowResult(false);
    setResult(null);
    lastSegmentRef.current = -1;

    try {
      const res = await fetch("/api/me/daily-spin", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); setIsSpinning(false); return; }

      const reward = data.reward as SpinReward;
      setResult(reward);

      const matches = WHEEL_SEGMENTS.map((s, i) => s.amount === reward.amount ? i : -1).filter(i => i !== -1);
      const targetIdx = matches[Math.floor(Math.random() * matches.length)] || 0;
      const curr = ((rotation % 360) + 360) % 360;
      const target = (360 - (targetIdx * SEGMENT_ANGLE + SEGMENT_ANGLE / 2) + 360) % 360;
      let delta = target - curr;
      if (delta <= 0) delta += 360;
      const spins = 5 + Math.floor(Math.random() * 3);
      const targetRot = rotation + spins * 360 + delta + (Math.random() - 0.5) * SEGMENT_ANGLE * 0.5;

      const startRot = rotation;
      const startTime = Date.now();
      const duration = 5000;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const p = Math.min(elapsed / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3.5);
        const currRot = startRot + (targetRot - startRot) * ease;
        setRotation(currRot);
        drawWheel(currRot);

        const seg = getCurrentSegment(currRot);
        if (seg !== lastSegmentRef.current && lastSegmentRef.current !== -1) {
          playTick(0.04 + (1 - p) * 0.15);
        }
        lastSegmentRef.current = seg;

        if (p < 1) {
          animationRef.current = requestAnimationFrame(animate);
        } else {
          setIsSpinning(false);
          setShowResult(true);
          if (onBalanceUpdate && data.newBalance !== undefined) onBalanceUpdate(data.newBalance);
          if (reward.amount > 0) toast.success(`You won ${reward.label}!`);
          fetchSpinStatus();
        }
      };
      animationRef.current = requestAnimationFrame(animate);
    } catch (e) {
      console.error(e);
      toast.error("Something went wrong");
      setIsSpinning(false);
    }
  }

  useEffect(() => () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-sm bg-background dark:bg-zinc-900/95 backdrop-blur-md border border-border dark:border-white/10 rounded-2xl shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Daily Spin</h2>
            <p className="text-xs text-muted-foreground">Win up to $20,000</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Wheel */}
        <div className="flex flex-col items-center px-5 pt-4 pb-4">
          {/* Canvas wrapper for overlay positioning */}
          <div className="relative" style={{ width: 280, height: 280 }}>
            {/* Pointer with shadow */}
            <div 
              className="absolute left-1/2 -translate-x-1/2 z-20 drop-shadow-lg"
              style={{
                top: 0,
                borderLeft: "12px solid transparent",
                borderRight: "12px solid transparent",
                borderTop: "18px solid #dc2626",
                filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.3))",
              }}
            />
            <canvas ref={canvasRef} className="w-full h-full" />

            {/* Result overlay */}
            {showResult && result && (
              <div 
                className="absolute inset-0 flex items-center justify-center rounded-full bg-background/95 backdrop-blur-sm"
              >
                <div className="text-center">
                <div className={`text-3xl font-semibold ${result.amount >= 5000 ? "text-amber-400" : "text-primary"}`}>
                  {result.label}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {spinStatus?.canSpin === false && !isSpinning ? "Today's reward" : "Added to balance"}
                </div>
              </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 space-y-2">
          {spinStatus?.canSpin ? (
            <button
              onClick={handleSpin}
              disabled={isSpinning}
              className="w-full h-11 rounded-lg font-medium text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSpinning ? "Spinning..." : "Spin"}
            </button>
          ) : (
            <div className="text-center py-2">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground text-xs mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Next spin in</span>
              </div>
              <div className="text-lg font-mono text-foreground">{countdown || "—"}</div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
