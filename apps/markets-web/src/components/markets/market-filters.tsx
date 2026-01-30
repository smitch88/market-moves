"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { 
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@vault/ui";
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
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  BadgeCheck,
  Calendar,
  Check,
  ChevronDown,
  Filter,
  Bookmark,
} from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

const viewFilters = [
  { label: "Trending", value: "trending", icon: Flame },
  { label: "Ending Soon", value: "ending", icon: Clock },
  { label: "New", value: "new", icon: Sparkles },
  { label: "Bookmarks", value: "bookmarks", icon: Bookmark, requiresAuth: true },
];

const categoryFilters = [
  { label: "All", value: "all", icon: LayoutGrid },
  { label: "NFL", value: "NFL", icon: Trophy },
  { label: "NBA", value: "NBA", icon: Volleyball },
  { label: "UFC", value: "UFC", icon: Dumbbell },
  { label: "Soccer", value: "SOCCER", icon: Volleyball },
  { label: "Politics", value: "POLITICS", icon: Vote },
  { label: "Crypto", value: "CRYPTO", icon: Bitcoin },
];

const sortOptions = [
  { label: "Volume", value: "volume", icon: TrendingUp, description: "Total trading volume" },
  { label: "Verified", value: "verified", icon: BadgeCheck, description: "KOL verifications" },
  { label: "Start Date", value: "startDate", icon: Calendar, description: "Event start time" },
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
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [viewMenuOpen, setViewMenuOpen] = useState(false);
  const [categoryMenuOpen, setCategoryMenuOpen] = useState(false);
  const { authenticated, login } = usePrivy();

  // Filter view options based on auth status
  const availableViewFilters = viewFilters.filter(
    (f) => !f.requiresAuth || authenticated
  );

  const currentView = searchParams.get("view") || "trending";
  const currentCategory = searchParams.get("category") || "all";
  const currentSortBy = searchParams.get("sortBy") || "volume";
  const currentSortDir = searchParams.get("sortDir") || "desc";

  const handleFilter = (key: string, value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if ((value === "all" && key === "category") || (value === "trending" && key === "view")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
      router.push(`/?${params.toString()}`);
    });
  };

  const handleSort = (sortBy: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      // If clicking the same sort, toggle direction
      if (currentSortBy === sortBy) {
        params.set("sortDir", currentSortDir === "desc" ? "asc" : "desc");
      } else {
        params.set("sortBy", sortBy);
        params.set("sortDir", "desc"); // Default to desc for new sort
      }
      router.push(`/?${params.toString()}`);
    });
    setSortMenuOpen(false);
  };

  const toggleSortDirection = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("sortDir", currentSortDir === "desc" ? "asc" : "desc");
      router.push(`/?${params.toString()}`);
    });
  };

  const currentSortOption = sortOptions.find((s) => s.value === currentSortBy) || sortOptions[0];
  const currentViewOption = availableViewFilters.find((v) => v.value === currentView) || availableViewFilters[0];
  const currentCategoryOption = categoryFilters.find((c) => c.value === currentCategory) || categoryFilters[0];
  const ViewIcon = currentViewOption.icon;
  const CategoryIcon = currentCategoryOption.icon;

  const handleViewFilter = (value: string) => {
    const filter = viewFilters.find((f) => f.value === value);
    if (filter?.requiresAuth && !authenticated) {
      login();
      return;
    }
    handleFilter("view", value);
  };

  return (
    <motion.div 
      className="flex flex-wrap items-center justify-between gap-2 sm:gap-3"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* Mobile: Dropdown menus in a single row */}
      <div className="flex sm:hidden items-center gap-2 w-full">
        {/* View Dropdown - Mobile */}
        <DropdownMenu open={viewMenuOpen} onOpenChange={setViewMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "flex-1 justify-between gap-2 h-9 px-3 rounded-full bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                isPending && "opacity-50 pointer-events-none"
              )}
            >
              <span className="flex items-center gap-1.5">
                <ViewIcon className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{currentViewOption.label}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {availableViewFilters.map((filter) => {
              const Icon = filter.icon;
              const isActive = currentView === filter.value;
              return (
                <DropdownMenuItem
                  key={filter.value}
                  onClick={() => {
                    handleViewFilter(filter.value);
                    setViewMenuOpen(false);
                  }}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{filter.label}</span>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Category Dropdown - Mobile */}
        <DropdownMenu open={categoryMenuOpen} onOpenChange={setCategoryMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "flex-1 justify-between gap-2 h-9 px-3 rounded-full bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                isPending && "opacity-50 pointer-events-none"
              )}
            >
              <span className="flex items-center gap-1.5">
                <CategoryIcon className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{currentCategoryOption.label}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            {categoryFilters.map((filter) => {
              const Icon = filter.icon;
              const isActive = currentCategory === filter.value;
              return (
                <DropdownMenuItem
                  key={filter.value}
                  onClick={() => {
                    handleFilter("category", filter.value);
                    setCategoryMenuOpen(false);
                  }}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{filter.label}</span>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort Dropdown - Mobile */}
        <DropdownMenu open={sortMenuOpen} onOpenChange={setSortMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 w-9 p-0 rounded-full bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                isPending && "opacity-50 pointer-events-none"
              )}
            >
              {currentSortDir === "desc" ? (
                <ArrowDown className="h-3.5 w-3.5" />
              ) : (
                <ArrowUp className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {sortOptions.map((option) => {
              const Icon = option.icon;
              const isActive = currentSortBy === option.value;
              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleSort(option.value)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="text-xs text-muted-foreground mb-2">Direction</p>
              <div className="flex gap-2">
                <Button
                  variant={currentSortDir === "desc" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 h-8 gap-1.5"
                  onClick={() => {
                    if (currentSortDir !== "desc") {
                      handleFilter("sortDir", "desc");
                    }
                    setSortMenuOpen(false);
                  }}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Desc.
                </Button>
                <Button
                  variant={currentSortDir === "asc" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 h-8 gap-1.5"
                  onClick={() => {
                    if (currentSortDir !== "asc") {
                      handleFilter("sortDir", "asc");
                    }
                    setSortMenuOpen(false);
                  }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Asc.
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Desktop: Inline buttons */}
      <div className="hidden sm:flex flex-wrap items-center gap-3">
        {/* View filters dropdown */}
        <motion.div variants={itemVariants}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "gap-2 h-9 px-3 rounded-full bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  isPending && "opacity-50 pointer-events-none"
                )}
              >
                <ViewIcon className="h-3.5 w-3.5" />
                <span className="font-medium text-foreground">{currentViewOption.label}</span>
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {availableViewFilters.map((filter) => {
                const Icon = filter.icon;
                const isActive = currentView === filter.value || (filter.value === "trending" && !searchParams.get("view"));
                return (
                  <DropdownMenuItem
                    key={filter.value}
                    onClick={() => handleViewFilter(filter.value)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span>{filter.label}</span>
                    </div>
                    {isActive && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </motion.div>

        {/* Divider */}
        <div className="h-6 w-px bg-border/50" />

        {/* Category filters */}
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
      </div>

      {/* Sort Dropdown - Desktop Right Side */}
      <motion.div 
        variants={itemVariants}
        className="hidden sm:flex items-center gap-1"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "gap-2 h-9 px-3 rounded-full bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
                isPending && "opacity-50 pointer-events-none"
              )}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              <span>Sort:</span>
              <span className="font-medium text-foreground">{currentSortOption.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {sortOptions.map((option) => {
              const Icon = option.icon;
              const isActive = currentSortBy === option.value;
              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => handleSort(option.value)}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                  {isActive && <Check className="h-4 w-4 text-primary" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="text-xs text-muted-foreground mb-2">Direction</p>
              <div className="flex gap-2">
                <Button
                  variant={currentSortDir === "desc" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 h-8 gap-1.5"
                  onClick={() => {
                    handleFilter("sortDir", "desc");
                  }}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                  Desc.
                </Button>
                <Button
                  variant={currentSortDir === "asc" ? "default" : "outline"}
                  size="sm"
                  className="flex-1 h-8 gap-1.5"
                  onClick={() => {
                    handleFilter("sortDir", "asc");
                  }}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                  Asc.
                </Button>
              </div>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Quick direction toggle button */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleSortDirection}
          className={cn(
            "h-9 w-9 p-0 rounded-full bg-transparent border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50",
            isPending && "opacity-50 pointer-events-none"
          )}
          title={currentSortDir === "desc" ? "Sorted high to low" : "Sorted low to high"}
        >
          {currentSortDir === "desc" ? (
            <ArrowDown className="h-3.5 w-3.5" />
          ) : (
            <ArrowUp className="h-3.5 w-3.5" />
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
