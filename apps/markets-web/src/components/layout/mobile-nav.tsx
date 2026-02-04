"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signIn } from "@vault/auth/client";
import { Trophy, TrendingUp, User } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@vault/ui/lib/utils";

export function MobileNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const authenticated = status === "authenticated";
  const ready = status !== "loading";

  // Don't show on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  const isMarketsActive = pathname === "/" || pathname.startsWith("/markets");
  const isLeaderboardActive = pathname === "/leaderboard";
  const isProfileActive = pathname === "/profile";

  const handleProfileClick = () => {
    if (!authenticated && ready) {
      signIn("twitter");
    }
  };

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/40 safe-area-bottom"
    >
      <div className="flex items-center justify-around px-6 py-2">
        {/* Left: Profile */}
        {authenticated ? (
          <Link href="/profile" className="flex-1">
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center gap-1 py-2"
            >
              <div className={cn(
                "p-2 rounded-xl transition-colors",
                isProfileActive ? "bg-muted text-foreground" : "text-muted-foreground"
              )}>
                <User className="h-5 w-5" />
              </div>
              <span className={cn(
                "text-[10px] font-medium transition-colors",
                isProfileActive ? "text-foreground" : "text-muted-foreground"
              )}>
                Profile
              </span>
            </motion.div>
          </Link>
        ) : (
          <button onClick={handleProfileClick} className="flex-1">
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center gap-1 py-2"
            >
              <div className="p-2 rounded-xl transition-colors text-muted-foreground">
                <User className="h-5 w-5" />
              </div>
              <span className="text-[10px] font-medium transition-colors text-muted-foreground">
                Profile
              </span>
            </motion.div>
          </button>
        )}

        {/* Center: Markets */}
        <Link href="/" className="relative -mt-6">
          <motion.div
            whileTap={{ scale: 0.9 }}
            className={cn(
              "relative flex items-center justify-center w-16 h-16 rounded-full shadow-lg",
              "bg-gradient-to-br from-[#df2421] to-[#ff4d4a]",
              "ring-4 ring-background"
            )}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 rounded-full bg-[#df2421]/30 blur-xl" />
            
            <TrendingUp className="h-7 w-7 text-white relative z-10" strokeWidth={2.5} />
            
            {/* Active indicator pulse */}
            {isMarketsActive && (
              <motion.div
                initial={{ scale: 1, opacity: 0.5 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full bg-[#df2421]"
              />
            )}
          </motion.div>
          <span className="sr-only">Markets</span>
        </Link>

        {/* Right: Leaderboard */}
        <Link href="/leaderboard" className="flex-1">
          <motion.div
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-1 py-2"
          >
            <div className={cn(
              "p-2 rounded-xl transition-colors",
              isLeaderboardActive ? "bg-muted text-foreground" : "text-muted-foreground"
            )}>
              <Trophy className="h-5 w-5" />
            </div>
            <span className={cn(
              "text-[10px] font-medium transition-colors",
              isLeaderboardActive ? "text-foreground" : "text-muted-foreground"
            )}>
              Leaderboard
            </span>
          </motion.div>
        </Link>
      </div>
    </motion.nav>
  );
}
