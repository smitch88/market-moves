"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { usePrivy } from "@privy-io/react-auth";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Avatar,
  AvatarImage,
  AvatarFallback,
  GlassCard,
} from "@vault/ui";
import {
  Star,
  Users,
  TrendingUp,
  ChevronRight,
  Check,
  Loader2,
  Trophy,
  Zap,
} from "lucide-react";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

interface KOLInfo {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
  referralCode: string;
  followerCount: number;
}

interface CaptainJoinProps {
  kol: KOLInfo;
}

export function CaptainJoin({ kol }: CaptainJoinProps) {
  const router = useRouter();
  const { login, authenticated, ready } = usePrivy();
  const authFetch = useAuthFetch();
  const [claimed, setClaimed] = useState(false);

  const kolName = kol.name || kol.handle || "Captain";

  // Store KOL code in localStorage for post-login flow
  useEffect(() => {
    localStorage.setItem("captain_code", kol.referralCode);
    localStorage.setItem("captain_id", kol.id);
  }, [kol.referralCode, kol.id]);

  // Check if user already has this captain selected
  const { data: currentCaptain, isLoading: captainLoading } = useQuery({
    queryKey: ["my-captain"],
    queryFn: async () => {
      const res = await authFetch("/api/me/captain");
      if (!res.ok) return null;
      const data = await res.json();
      return data.captain;
    },
    enabled: authenticated && ready,
  });

  // Mutation to claim captain
  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/captain/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kolId: kol.id,
          referralCode: kol.referralCode,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to select captain");
      }
      return res.json();
    },
    onSuccess: () => {
      setClaimed(true);
      // Clear stored values
      localStorage.removeItem("captain_code");
      localStorage.removeItem("captain_id");
      // Redirect after a short delay
      setTimeout(() => router.push("/"), 2000);
    },
  });

  // Auto-claim after login if user came from this page
  useEffect(() => {
    if (authenticated && ready && !captainLoading) {
      const storedCaptainId = localStorage.getItem("captain_id");
      
      // If they just logged in and have a stored captain to claim
      if (storedCaptainId === kol.id && !currentCaptain && !claimed) {
        claimMutation.mutate();
      }
    }
  }, [authenticated, ready, captainLoading, currentCaptain, kol.id, claimed]);

  const handleLogin = () => {
    login();
  };

  const handleClaim = () => {
    if (!authenticated) {
      login();
      return;
    }
    claimMutation.mutate();
  };

  const alreadyHasThisCaptain = currentCaptain?.id === kol.id;
  const hasOtherCaptain = currentCaptain && currentCaptain.id !== kol.id;

  return (
    <div className="min-h-screen grid-bg flex flex-col">
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
              <h1 className="text-3xl font-bold tracking-tight">
                Join a <span className="text-primary">Captain&apos;s Team</span>
              </h1>
              <p className="text-muted-foreground mt-2">
                Compete together and earn bonus rewards
              </p>
            </motion.div>
          </div>

          {/* KOL Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlassCard className="p-6">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-primary/30">
                    <AvatarImage src={kol.profileImageUrl || undefined} />
                    <AvatarFallback className="bg-gradient-to-br from-[#df2421] to-orange-600 text-white text-2xl">
                      {kolName[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
                    <Star className="h-4 w-4 text-primary-foreground fill-primary-foreground" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-xl font-semibold">{kolName}</p>
                    <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                      Captain
                    </span>
                  </div>
                  {kol.handle && (
                    <p className="text-sm text-muted-foreground">@{kol.handle}</p>
                  )}
                  <div className="flex items-center gap-1 mt-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{kol.followerCount} team members</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>

          {/* Benefits */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <BenefitItem
              icon={Trophy}
              title="Win Together"
              description="Earn bonus MP when your captain wins the daily competition"
              delay={0.5}
            />
            <BenefitItem
              icon={TrendingUp}
              title="Track Performance"
              description="See how your captain ranks on the Captains leaderboard"
              delay={0.55}
            />
            <BenefitItem
              icon={Zap}
              title="Exclusive Benefits"
              description="Get notified when your captain makes predictions"
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
            {claimed ? (
              <div className="text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                  <Check className="h-8 w-8 text-emerald-500" />
                </div>
                <p className="text-lg font-medium">
                  You&apos;ve joined {kolName}&apos;s team!
                </p>
                <p className="text-sm text-muted-foreground">
                  Redirecting you to the homepage...
                </p>
              </div>
            ) : alreadyHasThisCaptain ? (
              <div className="text-center space-y-3">
                <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto">
                  <Check className="h-8 w-8 text-primary" />
                </div>
                <p className="text-lg font-medium">
                  {kolName} is already your captain!
                </p>
                <Button onClick={() => router.push("/")} className="w-full">
                  Continue to Vault Markets
                </Button>
              </div>
            ) : (
              <>
                <Button
                  onClick={handleClaim}
                  size="lg"
                  className="w-full h-14 text-lg font-semibold"
                  disabled={!ready || claimMutation.isPending}
                >
                  {claimMutation.isPending ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Joining team...
                    </>
                  ) : !authenticated ? (
                    <>
                      Sign in to Join Team
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </>
                  ) : hasOtherCaptain ? (
                    <>
                      Switch to {kolName}&apos;s Team
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </>
                  ) : (
                    <>
                      Join {kolName}&apos;s Team
                      <ChevronRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>

                {hasOtherCaptain && (
                  <p className="text-center text-xs text-muted-foreground">
                    You currently follow {currentCaptain.name || currentCaptain.handle}. 
                    Joining this team will switch your captain.
                  </p>
                )}

                {claimMutation.isError && (
                  <p className="text-center text-sm text-red-500">
                    {claimMutation.error.message}
                  </p>
                )}

                <p className="text-center text-xs text-muted-foreground">
                  By joining, you agree to our Terms of Service and Privacy Policy
                </p>
              </>
            )}
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

function BenefitItem({
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
