"use client";

import { Search, X, TrendingUp, Clock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useCallback, useEffect, useRef } from "react";
import { Input, Button } from "@vault/ui";
import { cn } from "@vault/ui/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { getMarketUrl } from "@/lib/urls";

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  question: string;
  category: string;
  logoUrl: string | null;
  closesAt: string | null;
  outcomes: { id: string; key: string; label: string }[];
  _count: { bets: number };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [isFocused, setIsFocused] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebounce(query, 300);

  // Search API call
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setResults([]);
      return;
    }

    const searchMarkets = async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/markets/search?q=${encodeURIComponent(debouncedQuery)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.markets || []);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    searchMarkets();
  }, [debouncedQuery]);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = useCallback((value: string) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set("q", value);
      } else {
        params.delete("q");
      }
      router.push(`/?${params.toString()}`);
    });
    setShowDropdown(false);
  }, [router, searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
    inputRef.current?.blur();
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    handleSearch("");
  };

  const handleResultClick = () => {
    setShowDropdown(false);
    setQuery("");
  };

  const handleFocus = () => {
    setIsFocused(true);
    if (query.length >= 2) {
      setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Delay hiding to allow click on results
    setTimeout(() => {
      if (!containerRef.current?.contains(document.activeElement)) {
        setShowDropdown(false);
      }
    }, 150);
  };

  // Show dropdown when we have results or are searching
  useEffect(() => {
    if (isFocused && (results.length > 0 || (debouncedQuery.length >= 2 && isSearching))) {
      setShowDropdown(true);
    } else if (debouncedQuery.length < 2) {
      setShowDropdown(false);
    }
  }, [results, isFocused, debouncedQuery, isSearching]);

  return (
    <div ref={containerRef} className="relative w-full">
      <form onSubmit={handleSubmit}>
        <div
          className={cn(
            "relative flex items-center rounded-lg transition-all duration-200",
            "bg-muted/50 dark:bg-white/[0.04]",
            "border border-transparent",
            isFocused && "border-primary/50 bg-background dark:bg-white/[0.06] ring-1 ring-primary/20"
          )}
        >
          <Search className={cn(
            "absolute left-3.5 h-4 w-4 transition-colors",
            isFocused ? "text-primary" : "text-muted-foreground"
          )} />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Search markets..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            disabled={isPending}
            className={cn(
              "pl-10 pr-9 h-10 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground/60"
            )}
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="absolute right-2 h-7 w-7 p-0 hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      </form>

      {/* Search Results Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-2 z-50"
          >
            <div className="glass rounded-xl border border-border/50 shadow-xl overflow-hidden">
              {isSearching ? (
                <div className="p-4 flex items-center justify-center gap-2 text-muted-foreground">
                  <div className="h-4 w-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  <span className="text-sm">Searching...</span>
                </div>
              ) : results.length > 0 ? (
                <div className="py-2">
                  <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Markets
                  </div>
                  {results.map((market, index) => (
                    <Link
                      key={market.id}
                      href={getMarketUrl(market.slug)}
                      onClick={handleResultClick}
                    >
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors flex items-start gap-3"
                      >
                        {/* Logo */}
                        <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center">
                          {market.logoUrl ? (
                            <Image
                              src={market.logoUrl}
                              alt=""
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <TrendingUp className="h-5 w-5 text-muted-foreground/50" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground line-clamp-1">
                            {market.title}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground capitalize">
                              {market.category.toLowerCase().replace("_", " ")}
                            </span>
                            {market._count.bets > 0 && (
                              <>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="text-xs text-muted-foreground">
                                  {market._count.bets} bets
                                </span>
                              </>
                            )}
                            {market.closesAt && (
                              <>
                                <span className="text-muted-foreground/30">•</span>
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(market.closesAt).toLocaleDateString()}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  ))}
                  
                  {/* View all results */}
                  {query && (
                    <button
                      onClick={() => handleSearch(query)}
                      className="w-full px-3 py-2.5 text-sm text-primary hover:bg-muted/50 transition-colors border-t border-border/30 flex items-center justify-center gap-1.5"
                    >
                      <Search className="h-3.5 w-3.5" />
                      View all results for &quot;{query}&quot;
                    </button>
                  )}
                </div>
              ) : debouncedQuery.length >= 2 ? (
                <div className="p-4 text-center text-muted-foreground">
                  <p className="text-sm">No markets found for &quot;{debouncedQuery}&quot;</p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
