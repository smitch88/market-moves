"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@vault/ui";
import { Search, X, TrendingUp, Clock, Loader2, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface SearchResult {
  id: string;
  slug: string;
  title: string;
  category: string;
  status: string;
  logoUrl: string | null;
  closesAt: string | null;
  _count: { bets: number };
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
      const res = await fetch(`/api/markets/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.markets as SearchResult[];
    },
    enabled: debouncedQuery.length >= 2,
  });

  const handleNavigate = useCallback((slug: string) => {
    onOpenChange(false);
    setQuery("");
    router.push(`/markets/${slug}`);
  }, [router, onOpenChange]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onOpenChange(false);
      setQuery("");
      router.push(`/?search=${encodeURIComponent(query.trim())}`);
    }
  }, [query, router, onOpenChange]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    setQuery("");
  }, [onOpenChange]);

  // Clear query when modal closes
  useEffect(() => {
    if (!open) {
      setQuery("");
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
          className="fixed inset-0 flex flex-col"
          style={{ 
            backgroundColor: '#0d0d0d',
            zIndex: 9999,
          }}
        >
          {/* Header with search */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.05 }}
            className="flex-shrink-0 border-b border-white/10 safe-area-top"
            style={{ backgroundColor: '#0d0d0d' }}
          >
            <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={handleClose}
                className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-white" />
              </button>
              <div className="flex-1 flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2.5">
                <Search className="h-5 w-5 text-white/50 flex-shrink-0" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search markets..."
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 h-auto text-base text-white placeholder:text-white/50"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="p-1 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X className="h-4 w-4 text-white/50" />
                  </button>
                )}
              </div>
            </form>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex-1 overflow-y-auto"
            style={{ backgroundColor: '#0d0d0d' }}
          >
            {isLoading && debouncedQuery.length >= 2 ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-white/50" />
              </div>
            ) : results && results.length > 0 ? (
              <div className="p-4 space-y-3">
                <p className="text-xs text-white/50 px-2 mb-4">
                  {results.length} result{results.length !== 1 ? "s" : ""} found
                </p>
                <AnimatePresence mode="popLayout">
                  {results.map((market, i) => (
                    <motion.button
                      key={market.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => handleNavigate(market.slug)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all text-left"
                    >
                      {market.logoUrl ? (
                        <div className="h-14 w-14 rounded-xl overflow-hidden flex-shrink-0 bg-white/10">
                          <Image
                            src={market.logoUrl}
                            alt=""
                            width={56}
                            height={56}
                            className="object-cover w-full h-full"
                          />
                        </div>
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#df2421]/30 to-[#df2421]/10 flex items-center justify-center flex-shrink-0">
                          <TrendingUp className="h-6 w-6 text-[#df2421]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-clamp-2 text-white">{market.title}</p>
                        <div className="flex items-center gap-2 text-xs text-white/50 mt-1">
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] uppercase font-medium text-white/70">
                            {market.category}
                          </span>
                          <span>{market._count.bets} bets</span>
                          {market.closesAt && (
                            <>
                              <span>•</span>
                              <Clock className="h-3 w-3" />
                              <span>{new Date(market.closesAt).toLocaleDateString()}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            ) : debouncedQuery.length >= 2 ? (
              <div className="py-20 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-white/20" />
                <p className="text-lg font-medium text-white">No markets found</p>
                <p className="text-sm mt-1 text-white/50">Try a different search term</p>
              </div>
            ) : (
              <div className="py-20 text-center">
                <Search className="h-12 w-12 mx-auto mb-4 text-white/20" />
                <p className="text-lg font-medium text-white">Search markets</p>
                <p className="text-sm mt-1 text-white/50">Type to find prediction markets</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}
