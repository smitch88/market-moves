"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { motion } from "framer-motion";
import { 
  Flame, 
  Clock, 
  Sparkles, 
  Trophy, 
  Tv, 
  Dumbbell,
  Vote,
  Bitcoin,
  LayoutGrid,
  Gamepad2,
  Volleyball,
} from "lucide-react";

const sortFilters = [
  { label: "Trending", value: "trending", icon: Flame },
  { label: "Ending Soon", value: "ending", icon: Clock },
  { label: "New", value: "new", icon: Sparkles },
];

const categoryFilters = [
  { label: "All", value: "all", icon: LayoutGrid },
  { label: "NFL", value: "NFL", icon: Trophy },
  { label: "NBA", value: "NBA", icon: Volleyball },
  { label: "UFC", value: "UFC", icon: Dumbbell },
  { label: "Soccer", value: "SOCCER", icon: Volleyball },
  { label: "Entertainment", value: "ENTERTAINMENT", icon: Tv },
  { label: "Politics", value: "POLITICS", icon: Vote },
  { label: "Crypto", value: "CRYPTO", icon: Bitcoin },
  { label: "Other", value: "OTHER", icon: Gamepad2 },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const }
  },
};

export function MarketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentSort = searchParams.get("sort") || "trending";
  const currentCategory = searchParams.get("category") || "all";

  const handleFilter = (key: string, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "all" && key === "category") {
        params.delete("category");
      } else {
        params.set(key, value);
      }
      router.push(`/?${params.toString()}`);
    });
  };

  return (
    <motion.div 
      className="flex flex-wrap items-center gap-3"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Sort filters */}
      <motion.div 
        className="flex items-center gap-2 overflow-x-auto scrollbar-none"
        variants={containerVariants}
      >
        {sortFilters.map((filter) => {
          const Icon = filter.icon;
          const isActive = currentSort === filter.value;
          return (
            <motion.div key={filter.value} variants={itemVariants} className="flex-shrink-0">
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilter("sort", filter.value)}
                className={cn(
                  "gap-1.5 h-9 px-3 rounded-full",
                  isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/20",
                  !isActive && "bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  isPending && "opacity-50 pointer-events-none"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {filter.label}
              </Button>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Divider */}
      <div className="hidden sm:block h-6 w-px bg-border/50" />

      {/* Category filters - horizontal scroll on mobile, inline on desktop */}
      <motion.div 
        className="flex items-center gap-2 overflow-x-auto scrollbar-none"
        variants={containerVariants}
      >
        {categoryFilters.map((filter) => {
          const Icon = filter.icon;
          const isActive = currentCategory === filter.value || (filter.value === "all" && !searchParams.get("category"));
          return (
            <motion.div key={filter.value} variants={itemVariants} className="flex-shrink-0">
              <Button
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilter("category", filter.value)}
                className={cn(
                  "gap-1.5 h-9 px-3 rounded-full",
                  isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/20",
                  !isActive && "bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  isPending && "opacity-50 pointer-events-none"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {filter.label}
              </Button>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
