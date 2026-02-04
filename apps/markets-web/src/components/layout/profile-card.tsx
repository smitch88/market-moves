"use client";

import { useState } from "react";
import { useSession, signOut } from "@vault/auth/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import Link from "next/link";
import Image from "next/image";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
  Input,
  toast,
} from "@vault/ui";
import { User, LogOut, ChevronDown, Bug, Gift, Check, Copy, Users, Shield, Sun, Moon, HelpCircle, Info } from "lucide-react";
import { useAuthFetch } from "@/lib/auth/auth-fetch";
import { openWelcomeModal } from "@/components/welcome/welcome-modal";
import { AnimatedXPRing, useXPAnimation } from "./xp-animation";

// Custom X (Twitter) logo icon
function XIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="currentColor"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
import { motion, AnimatePresence } from "framer-motion";

const isDev = process.env.NODE_ENV === "development";

export function ProfileCard() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [copied, setCopied] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const authFetch = useAuthFetch();
  
  // Fetch user profile (works for both real auth and impersonation)
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const res = await authFetch("/api/me");
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Fetch XP for level calculation
  const { data: xpData } = useQuery({
    queryKey: ["xp"],
    queryFn: async () => {
      const res = await authFetch("/api/me/xp");
      if (!res.ok) return { xp: 0 };
      return res.json();
    },
  });

  const xp = xpData?.xp ?? 0;
  const level = xpData?.level ?? 0;
  const progress = xpData?.progress ?? 0;
  const xpInCurrentLevel = xpData?.xpInCurrentLevel ?? 0;
  const xpNeededForNext = xpData?.xpNeededForNext ?? 1;

  // Get animation state from context (watchers are in header.tsx)
  const { isAnimating } = useXPAnimation();

  // Check impersonation state separately
  const { data: impersonationData } = useQuery({
    queryKey: ["dev-impersonation"],
    queryFn: async () => {
      const res = await fetch("/api/dev/impersonate");
      if (!res.ok) return { active: false, user: null };
      return res.json();
    },
    enabled: isDev,
  });

  const isImpersonating = isDev && impersonationData?.active;

  // Use profile data (works for both real auth and impersonation)
  const displayName = profile?.name || profile?.handle || 
    session?.user?.name || "User";
  const avatarUrl = profile?.profileImageUrl || session?.user?.image;

  // Use handle for nicer referral links, fall back to referral code
  const referralLink = (profile?.handle || profile?.referralCode)
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/r/${profile?.handle || profile?.referralCode}`
    : "";

  const handleCopyReferral = async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Referral link copied to clipboard!");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleShareOnX = () => {
    const tweetText = encodeURIComponent(
      `Join me on Vault Markets! Make predictions on real-world events and compete with friends. 🎯\n\n${referralLink}`
    );
    window.open(`https://x.com/intent/tweet?text=${tweetText}`, "_blank");
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/" });
  };

  const friendsInvited = profile?._count?.referralsGiven ?? 0;
  const isAdmin = profile?.role === "ADMIN";

  return (
    <>
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button className={`flex items-center gap-2 px-3 py-1.5 rounded-full glass glass-hover ${isImpersonating ? "ring-2 ring-amber-500/50" : ""}`}>
          {/* Avatar with animated progress ring */}
          <div className="relative">
            <AnimatedXPRing progress={progress} size="sm" isAnimating={isAnimating}>
              {avatarUrl ? (
                <Image src={avatarUrl} alt={displayName} fill className="object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
                  <User className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </AnimatedXPRing>
            {isImpersonating && (
              <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-amber-500 border-2 border-background flex items-center justify-center">
                <Bug className="h-2 w-2 text-amber-950" />
              </div>
            )}
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-foreground font-semibold">Lvl {level}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} collisionPadding={16} className="w-56">
        {isImpersonating && (
          <>
            <div className="px-2 py-1.5 bg-amber-500/10 border-b border-amber-500/30">
              <div className="flex items-center gap-1.5 text-amber-500">
                <Bug className="h-3 w-3" />
                <span className="text-xs font-medium">Dev Impersonation Active</span>
              </div>
            </div>
          </>
        )}
        {/* User info with avatar and XP ring */}
        <div className="px-3 py-3 flex items-center gap-3">
          {/* Avatar with animated progress ring */}
          <AnimatedXPRing progress={progress} size="md" isAnimating={isAnimating}>
            {avatarUrl ? (
              <Image src={avatarUrl} alt={displayName} fill className="object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
                <User className="h-4 w-4 text-white" />
              </div>
            )}
          </AnimatedXPRing>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-foreground font-semibold">Lvl {level}</p>
            <p className="text-xs text-[#21C55E] font-semibold">${(profile?.balance ?? 0).toLocaleString()}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin" className="cursor-pointer">
              <Shield className="mr-2 h-4 w-4" />
              Admin
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => setInviteModalOpen(true)} className="cursor-pointer">
          <Gift className="mr-2 h-4 w-4" />
          Invite Friends
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/faq" className="cursor-pointer">
            <HelpCircle className="mr-2 h-4 w-4" />
            FAQ
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")} 
          className="cursor-pointer"
        >
          {theme === "dark" ? (
            <Sun className="mr-2 h-4 w-4" />
          ) : (
            <Moon className="mr-2 h-4 w-4" />
          )}
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={openWelcomeModal} className="cursor-pointer">
          <Info className="mr-2 h-4 w-4" />
          What's this?
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {isImpersonating ? (
          <DropdownMenuItem
            onClick={async () => {
              await fetch("/api/dev/impersonate", { method: "DELETE" });
              queryClient.invalidateQueries({ queryKey: ["profile"] });
              window.location.reload();
            }}
            className="cursor-pointer text-amber-500"
          >
            <Bug className="mr-2 h-4 w-4" />
            Stop Impersonating
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-[#df2421] focus:text-[#df2421]">
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    {/* Invite Friends Modal */}
    <Dialog open={inviteModalOpen} onOpenChange={setInviteModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Gift className="h-5 w-5 text-primary" />
            Invite Friends
          </DialogTitle>
          <DialogDescription>
            Share your unique referral link and earn 10,000 MP when friends join!
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-center gap-2 p-4 rounded-xl bg-primary/10 border border-primary/20"
          >
            <Users className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">Friends invited:</span>
            <span className="text-2xl font-bold text-primary">{friendsInvited}</span>
          </motion.div>

          {/* Referral Link */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <label className="text-sm font-medium text-muted-foreground">Your Referral Link</label>
            <div className="flex gap-2">
              <Input
                value={referralLink}
                readOnly
                className="font-mono text-sm bg-muted/50"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyReferral}
                className="shrink-0"
              >
                <AnimatePresence mode="wait">
                  {copied ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="h-4 w-4 text-outcome-yes" />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="copy"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Copy className="h-4 w-4" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </Button>
            </div>
            <AnimatePresence>
              {copied && (
                <motion.p
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="text-xs text-outcome-yes"
                >
                  Link copied to clipboard!
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Referral Code Display */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
          >
            <span className="text-sm text-muted-foreground">Your Code</span>
            <code className="px-3 py-1 rounded-md bg-background font-mono text-sm font-semibold">
              {profile?.handle || profile?.referralCode || "..."}
            </code>
          </motion.div>

          {/* Share Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <Button 
              onClick={handleShareOnX} 
              className="w-full gap-2 bg-black hover:bg-black/80 text-white border-0"
            >
              <XIcon className="h-4 w-4" />
              Post to X
            </Button>
            <Button 
              onClick={handleCopyReferral}
              variant="outline" 
              className="w-full gap-2"
            >
              <Copy className="h-4 w-4" />
              {copied ? "Copied!" : "Copy Link"}
            </Button>
          </motion.div>

          {/* Info */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-xs text-center text-muted-foreground"
          >
            When friends sign up using your link, you both earn 10,000 MP!
          </motion.p>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
