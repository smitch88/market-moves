"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@vault/ui";
import { Search, X, TrendingUp, Clock, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { getMarketUrl } from "@/lib/urls";

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  category: string;
  logoUrl: string | null;
  closesAt: string | null;
  betCount: number;
}

interface ApiMarketResult {
  id: string;
  question: string;
  endDate: string | null;
  betCount: number;
  event: {
    id: string;
    slug: string;
    title: string;
    category: string;
    icon: string | null;
  };
}

interface SearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search API
  const { data: results, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];
      const res = await fetch(`/api/markets/search?q=${encodeURIComponent(debouncedQuery)}&limit=8`);
      if (!res.ok) return [];
      const data = await res.json();
      
      // Transform API response to expected format
      const markets = (data.markets || []) as ApiMarketResult[];
      return markets.map((m): SearchResult => ({
        id: m.id,
        slug: m.event.slug,
        title: m.question,
        category: m.event.category,
        logoUrl: m.event.icon,
        closesAt: m.endDate,
        betCount: m.betCount ?? 0,
      }));
    },
    enabled: debouncedQuery.length >= 2,
  });

  const handleNavigate = useCallback((slug: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(getMarketUrl(slug));
  }, [router, onOpenChange]);

  const handleViewAllResults = useCallback(() => {
    if (query.trim()) {
      onOpenChange(false);
      setQuery("");
      router.push(`/?q=${encodeURIComponent(query.trim())}`);
    }
  }, [query, router, onOpenChange]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    handleViewAllResults();
  }, [handleViewAllResults]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setQuery("");
  }, [onOpenChange]);

  // Clear query when modal closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 flex flex-col bg-background"
          style={{ zIndex: 9999 }}
        >
          {/* Header with search */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05, duration: 0.15, ease: "easeOut" }}
            className="flex-shrink-0 border-b border-border/50 safe-area-top bg-background"
          >
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={handleClose}
                className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-foreground" />
              </button>
              <div className="flex-1 flex items-center gap-3 bg-muted/50 dark:bg-muted/30 rounded-xl px-4 py-2.5 border border-transparent focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <Search className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search markets..."
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto text-base text-foreground placeholder:text-muted-foreground"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="p-1 rounded-full hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </form>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.15 }}
            className="flex-1 overflow-y-auto bg-background"
          >
            {isLoading && debouncedQuery.length >= 2 ? (
              <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
                <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span className="text-sm">Searching...</span>
              </div>
            ) : results && results.length > 0 ? (
              <div className="py-2">
                <div className="px-5 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Markets
                </div>
                <AnimatePresence mode="popLayout">
                  {results.map((market, i) => (
                    <motion.button
                      key={market.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      transition={{ delay: i * 0.03, duration: 0.15 }}
                      onClick={() => handleNavigate(market.slug)}
                      className="w-full flex items-start gap-3 px-5 py-3 hover:bg-muted/50 active:bg-muted transition-colors text-left"
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
                        <p className="text-sm font-medium text-foreground line-clamp-2">
                          {market.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-muted-foreground capitalize">
                            {(market.category ?? "other").toLowerCase().replace("_", " ")}
                          </span>
                          {market.betCount > 0 && (
                            <>
                              <span className="text-muted-foreground/30">•</span>
                              <span className="text-xs text-muted-foreground">
                                {market.betCount} bets
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
                    </motion.button>
                  ))}
                </AnimatePresence>
                
                {/* View all results */}
                {query && (
                  <button
                    onClick={handleViewAllResults}
                    className="w-full px-5 py-3 text-sm text-primary hover:bg-muted/50 active:bg-muted transition-colors border-t border-border/30 flex items-center justify-center gap-1.5"
                  >
                    <Search className="h-3.5 w-3.5" />
                    View all results for &quot;{query}&quot;
                  </button>
                )}
              </div>
            ) : debouncedQuery.length >= 2 ? (
              <div className="py-20 text-center px-4">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-base font-medium text-foreground">No markets found</p>
                <p className="text-sm mt-1 text-muted-foreground">
                  No results for &quot;{debouncedQuery}&quot;
                </p>
              </div>
            ) : (
              <div className="py-20 text-center px-4">
                <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-base font-medium text-foreground">Search markets</p>
                <p className="text-sm mt-1 text-muted-foreground">
                  Type to find prediction markets
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
