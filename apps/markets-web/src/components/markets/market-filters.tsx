"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useState } from "react";
import { 
  Badge, 
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
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
  ChevronDown,
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
    transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }
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

  // Get current category label for dropdown
  const currentCategoryLabel = categoryFilters.find(
    f => f.value === currentCategory || (f.value === "all" && !searchParams.get("category"))
  )?.label || "All";

  const CurrentCategoryIcon = categoryFilters.find(
    f => f.value === currentCategory || (f.value === "all" && !searchParams.get("category"))
  )?.icon || LayoutGrid;

  return (
    <motion.div 
      className="lg:space-y-6"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Mobile filters row */}
      <div className="lg:hidden">
        <motion.div 
          className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4"
          variants={containerVariants}
        >
          {/* Sort buttons */}
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

          {/* Category dropdown */}
          <motion.div variants={itemVariants} className="flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant={currentCategory !== "all" && searchParams.get("category") ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "gap-1.5 h-9 px-3 rounded-full",
                    currentCategory !== "all" && searchParams.get("category") 
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                    isPending && "opacity-50 pointer-events-none"
                  )}
                >
                  <CurrentCategoryIcon className="h-3.5 w-3.5" />
                  {currentCategoryLabel}
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {categoryFilters.map((filter) => {
                  const Icon = filter.icon;
                  const isActive = currentCategory === filter.value || (filter.value === "all" && !searchParams.get("category"));
                  return (
                    <DropdownMenuItem
                      key={filter.value}
                      onClick={() => handleFilter("category", filter.value)}
                      className={cn(
                        "gap-2 cursor-pointer",
                        isActive && "bg-primary/10 text-primary"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {filter.label}
                      {isActive && (
                        <span className="ml-auto text-primary">✓</span>
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </motion.div>
        </motion.div>
      </div>

      {/* Desktop: Sort filters */}
      <div className="hidden lg:block">
        <motion.h3 
          variants={itemVariants}
          className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3"
        >
          Sort By
        </motion.h3>
        <motion.div 
          className="flex flex-col gap-2"
          variants={containerVariants}
        >
          {sortFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = currentSort === filter.value;
            return (
              <motion.div key={filter.value} variants={itemVariants}>
                <motion.div
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <Badge
                    variant={isActive ? "default" : "outline"}
                    onClick={() => handleFilter("sort", filter.value)}
                    className={cn(
                      "cursor-pointer transition-colors duration-200 justify-start gap-2 py-1.5 px-3 whitespace-nowrap",
                      isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/20",
                      !isActive && "bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border",
                      isPending && "opacity-50 pointer-events-none"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {filter.label}
                  </Badge>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Desktop: Category filters */}
      <div className="hidden lg:block">
        <motion.h3 
          variants={itemVariants}
          className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3"
        >
          Category
        </motion.h3>
        <motion.div 
          className="flex flex-col gap-2"
          variants={containerVariants}
        >
          {categoryFilters.map((filter) => {
            const Icon = filter.icon;
            const isActive = currentCategory === filter.value || (filter.value === "all" && !searchParams.get("category"));
            return (
              <motion.div key={filter.value} variants={itemVariants}>
                <motion.div
                  whileHover={{ scale: 1.02, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                >
                  <Badge
                    variant={isActive ? "default" : "outline"}
                    onClick={() => handleFilter("category", filter.value)}
                    className={cn(
                      "cursor-pointer transition-colors duration-200 justify-start gap-2 py-1.5 px-3",
                      isActive && "bg-primary text-primary-foreground shadow-md shadow-primary/20",
                      !isActive && "bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-border",
                      isPending && "opacity-50 pointer-events-none"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {filter.label}
                  </Badge>
                </motion.div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Footer - Desktop only */}
      <motion.div 
        variants={itemVariants}
        className="hidden lg:block pt-6 mt-6 border-t border-border/30"
      >
        <div className="flex flex-col gap-2 text-xs text-muted-foreground">
          <div className="flex gap-3">
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy
            </Link>
            <Link href="/faq" className="hover:text-foreground transition-colors">
              FAQ
            </Link>
          </div>
          <p className="text-muted-foreground/60">
            © {new Date().getFullYear()} Vault777
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
