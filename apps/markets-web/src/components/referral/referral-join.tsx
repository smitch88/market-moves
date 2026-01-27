"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Avatar, AvatarImage, AvatarFallback, GlassCard } from "@vault/ui";
import { TrendingUp, Users, Sparkles, ChevronRight, X } from "lucide-react";

interface ReferralJoinProps {
  referrer: {
    id: string;
    name: string | null;
    handle: string | null;
    profileImageUrl: string | null;
  };
  referralCode: string;
}

export function ReferralJoin({ referrer, referralCode }: ReferralJoinProps) {
  const router = useRouter();
  const { login, authenticated, ready } = usePrivy();
  const [showCampaign, setShowCampaign] = useState(false);

  const referrerName = referrer.name || referrer.handle || "A friend";

  // Store referral code in localStorage for attribution
  useEffect(() => {
    localStorage.setItem("referral_code", referralCode);
  }, [referralCode]);

  // Show campaign modal after a brief delay
  useEffect(() => {
    const timer = setTimeout(() => setShowCampaign(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Process referral and redirect after authentication
  useEffect(() => {
    if (authenticated && ready) {
      // Claim the referral
      fetch("/api/referral/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referralCode }),
      })
        .then(() => {
          // Clear stored code and redirect
          localStorage.removeItem("referral_code");
          router.push("/");
        })
        .catch(() => {
          // Still redirect even if claim fails
          router.push("/");
        });
    }
  }, [authenticated, ready, router, referralCode]);

  const handleLogin = () => {
    login();
  };

  return (
    <div className="min-h-screen grid-bg flex flex-col">
      {/* Campaign Modal */}
      <CampaignModal open={showCampaign} onClose={() => setShowCampaign(false)} />

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
              <Image
                src="/logo.svg"
                alt="Vault Markets"
                width={80}
                height={56}
                className="h-14 w-auto"
                priority
              />
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
              description="Both you and your referrer earn bonus entries"
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

            {/* Banner placeholder - replace URL later */}
            <div className="relative h-48 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Sparkles className="h-12 w-12 text-primary mx-auto mb-3" />
                  <p className="text-2xl font-bold">Welcome to Vault</p>
                </div>
              </div>
              {/* Uncomment when banner URL is available:
              <Image
                src="/campaign-banner.png"
                alt="Campaign"
                fill
                className="object-cover"
              />
              */}
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
                  <span>Earn bonus entries through referrals</span>
                </div>
              </div>

              <Button onClick={onClose} className="w-full">
                Let's Go!
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
