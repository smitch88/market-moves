"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Avatar, AvatarImage, AvatarFallback, GlassCard } from "@vault/ui";
import { TrendingUp, Users, Sparkles, ChevronRight, X, HelpCircle, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";

interface ReferralJoinProps {
  referrer: {
    id: string;
    name: string | null;
    handle: string | null;
    profileImageUrl: string | null;
  };
  referralCode: string;
}

type ClaimStatus = "idle" | "claiming" | "success" | "already_referred" | "self_referral" | "window_expired" | "error";

export function ReferralJoin({ referrer, referralCode }: ReferralJoinProps) {
  const router = useRouter();
  const { login, authenticated, ready } = usePrivy();
  const [showCampaign, setShowCampaign] = useState(false);
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>("idle");
  const [hasAttemptedClaim, setHasAttemptedClaim] = useState(false);

  const referrerName = referrer.name || referrer.handle || "A friend";

  // Store referral code in localStorage for attribution (only for non-authenticated users)
  // IMPORTANT: First-click attribution - only set if no code exists to prevent gaming
  useEffect(() => {
    if (!authenticated) {
      const existingCode = localStorage.getItem("referral_code");
      if (!existingCode) {
        localStorage.setItem("referral_code", referralCode);
      }
    }
  }, [referralCode, authenticated]);

  // Show campaign modal after a brief delay (only for non-authenticated users)
  useEffect(() => {
    if (!authenticated) {
      const timer = setTimeout(() => setShowCampaign(true), 1500);
      return () => clearTimeout(timer);
    }
  }, [authenticated]);

  // Auto-claim referral when user is authenticated (only once)
  useEffect(() => {
    if (authenticated && ready && !hasAttemptedClaim) {
      setHasAttemptedClaim(true);
      claimReferral();
    }
  }, [authenticated, ready, hasAttemptedClaim]);

  const claimReferral = async () => {
    setClaimStatus("claiming");
    try {
      const response = await fetch("/api/referral/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode }),
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        localStorage.removeItem("referral_code");
        setClaimStatus("success");
      } else if (data.message === "Already referred by someone") {
        // Clear localStorage since they can't claim any referral
        localStorage.removeItem("referral_code");
        setClaimStatus("already_referred");
      } else if (data.message === "Referral window expired") {
        // Clear localStorage since they can no longer claim referrals
        localStorage.removeItem("referral_code");
        setClaimStatus("window_expired");
      } else if (data.error === "Cannot refer yourself") {
        // Clear localStorage since they can't use their own code
        localStorage.removeItem("referral_code");
        setClaimStatus("self_referral");
      } else {
        setClaimStatus("error");
      }
    } catch {
      setClaimStatus("error");
    }
  };

  const handleLogin = () => {
    login();
  };

  // Show different UI based on claim status for authenticated users
  const renderAuthenticatedContent = () => {
    if (claimStatus === "claiming") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GlassCard className="p-6 text-center">
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-lg font-medium">Claiming referral bonus...</p>
          </GlassCard>
        </motion.div>
      );
    }

    if (claimStatus === "success") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GlassCard className="p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-green-500 mb-2">Referral Claimed!</h3>
            <p className="text-muted-foreground mb-4">
              You and {referrerName} both earned 10,000 MP!
            </p>
            <Link href="/">
              <Button className="w-full">
                Start Trading
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCard>
        </motion.div>
      );
    }

    if (claimStatus === "already_referred") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GlassCard className="p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">Already Referred</h3>
            <p className="text-muted-foreground mb-4">
              You&apos;ve already been referred by another user. Thanks for checking out {referrerName}&apos;s link though!
            </p>
            <Link href="/">
              <Button className="w-full">
                View Markets
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCard>
        </motion.div>
      );
    }

    if (claimStatus === "self_referral") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GlassCard className="p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">This is Your Link!</h3>
            <p className="text-muted-foreground mb-4">
              You can&apos;t use your own referral link. Share it with friends to earn bonus MP!
            </p>
            <Link href="/">
              <Button className="w-full">
                View Markets
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCard>
        </motion.div>
      );
    }

    if (claimStatus === "window_expired") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GlassCard className="p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">Referral Window Expired</h3>
            <p className="text-muted-foreground mb-4">
              Referral bonuses can only be claimed within 7 days of creating your account. Thanks for checking out {referrerName}&apos;s link though!
            </p>
            <Link href="/">
              <Button className="w-full">
                View Markets
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCard>
        </motion.div>
      );
    }

    if (claimStatus === "error") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <GlassCard className="p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
            <h3 className="text-xl font-bold mb-2">Something Went Wrong</h3>
            <p className="text-muted-foreground mb-4">
              We couldn&apos;t process the referral. You can still explore the platform!
            </p>
            <Link href="/">
              <Button className="w-full">
                View Markets
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </GlassCard>
        </motion.div>
      );
    }

    return null;
  };

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Campaign Modal - only for non-authenticated users */}
      {!authenticated && <CampaignModal open={showCampaign} onClose={() => setShowCampaign(false)} />}

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md space-y-8"
        >
          {/* Logo and Title */}
          <div className="text-center space-y-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="flex justify-center"
            >
              <Link href="/">
                <Image
                  src="/logo.svg"
                  alt="Vault Markets"
                  width={80}
                  height={56}
                  className="h-14 w-auto"
                  priority
                />
              </Link>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-4xl font-bold tracking-tight">
                Vault <span className="text-primary">Markets</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                The future of prediction markets
              </p>
            </motion.div>
          </div>

          {/* Referrer Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard className="p-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-16 w-16 border-2 border-primary/30">
                    <AvatarImage src={referrer.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xl">
                      {referrerName[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Invited by</p>
                  <p className="text-xl font-semibold">{referrerName}</p>
                  {referrer.handle && referrer.name && (
                    <p className="text-sm text-muted-foreground">@{referrer.handle}</p>
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Different content for authenticated vs non-authenticated users */}
          {authenticated ? (
            // Authenticated: Show claim status
            renderAuthenticatedContent()
          ) : (
            // Not authenticated: Show features and login CTA
            <>
              {/* Features */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="space-y-3"
              >
                <FeatureItem
                  icon={TrendingUp}
                  title="Trade Predictions"
                  description="Bet on real-world outcomes across sports, crypto, politics & more"
                  delay={0.5}
                />
                <FeatureItem
                  icon={Users}
                  title="Compete & Win"
                  description="Start with $10,000 virtual credits and climb the leaderboard"
                  delay={0.55}
                />
                <FeatureItem
                  icon={Sparkles}
                  title="Referral Bonus"
                  description="Both you and your referrer earn 10,000 MP"
                  delay={0.6}
                />
              </motion.div>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="space-y-4"
              >
                <Button
                  onClick={handleLogin}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold"
                  disabled={!ready}
                >
                  {!ready ? (
                    "Loading..."
                  ) : (
                    <>
                      Join with X (Twitter)
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  By joining, you agree to our Terms of Service and Privacy Policy
                </p>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="py-6 text-center text-sm text-muted-foreground"
      >
        © {new Date().getFullYear()} Vault Markets. All virtual credits for entertainment only.
      </motion.footer>
    </div>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  description,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-start gap-3"
    >
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
}

function CampaignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-card border border-border shadow-2xl"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 h-8 w-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Hero Banner */}
            <div className="relative h-48 overflow-hidden">
              <Image
                src="/vault777markets.png"
                alt="Vault777 Markets - Predictions Are Coming"
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-xl font-bold">🎉 Launch Special</h2>
                <p className="text-muted-foreground mt-1">
                  Join now and get $10,000 in virtual credits to start trading predictions immediately!
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Trade on sports, crypto, politics & entertainment</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Compete with friends on the leaderboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <span>Earn MP through referrals</span>
                </div>
              </div>

              <Button onClick={onClose} className="w-full">
                Let's Go!
              </Button>

              <Link
                href="/faq"
                onClick={onClose}
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <HelpCircle className="h-4 w-4" />
                Learn more in our FAQ
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
