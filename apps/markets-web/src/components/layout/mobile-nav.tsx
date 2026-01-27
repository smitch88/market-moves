"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, HelpCircle, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@vault/ui/lib/utils";

const navItems = [
  {
    href: "/leaderboard",
    label: "Leaderboard",
    icon: Trophy,
  },
  {
    href: "/",
    label: "Markets",
    icon: TrendingUp,
    isCenter: true,
  },
  {
    href: "/faq",
    label: "FAQ",
    icon: HelpCircle,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  // Don't show on admin pages
  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-xl border-t border-border/40 safe-area-bottom"
    >
      <div className="flex items-center justify-around px-6 py-2">
        {navItems.map((item) => {
          const isActive = item.href === "/" 
            ? pathname === "/" || pathname.startsWith("/markets")
            : pathname === item.href;
          const Icon = item.icon;

          if (item.isCenter) {
            return (
              <Link key={item.href} href={item.href} className="relative -mt-6">
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
                  
                  <Icon className="h-7 w-7 text-white relative z-10" strokeWidth={2.5} />
                  
                  {/* Active indicator pulse */}
                  {isActive && (
                    <motion.div
                      initial={{ scale: 1, opacity: 0.5 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="absolute inset-0 rounded-full bg-[#df2421]"
                    />
                  )}
                </motion.div>
                <span className="sr-only">{item.label}</span>
              </Link>
            );
          }

          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <motion.div
                whileTap={{ scale: 0.9 }}
                className="flex flex-col items-center gap-1 py-2"
              >
                <div className={cn(
                  "p-2 rounded-xl transition-colors",
                  isActive ? "bg-muted text-foreground" : "text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}
