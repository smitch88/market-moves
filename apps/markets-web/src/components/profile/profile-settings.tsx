"use client";

import { useState, useEffect, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Input, Label } from "@vault/ui";
import { 
  Copy, 
  Check, 
  ExternalLink, 
  Twitter, 
  LogOut, 
  Users, 
  Loader2,
  User,
  AtSign,
  Image as ImageIcon,
  TrendingUp,
} from "lucide-react";
import { CaptainSelector } from "./captain-selector";
import { cn } from "@vault/ui/lib/utils";
import Image from "next/image";
import { useAuthFetch } from "@/lib/auth/auth-fetch";

interface ProfileSettingsProps {
  profile: {
    id: string;
    email: string | null;
    handle: string | null;
    name: string | null;
    profileImageUrl: string | null;
    bannerImageUrl: string | null;
    twitterSubject?: string | null;
    role: string;
    referralCode: string;
    _count?: {
      referralsGiven?: number;
    };
  };
  showReferrals?: boolean;
  onlyReferrals?: boolean;
}

interface HandleCheckResult {
  available: boolean;
  reason?: string;
}

interface ReferralStats {
  totalReferrals: number;
  qualifiedReferrals: number;
  totalReferredVolume: number;
}

export function ProfileSettings({ profile, showReferrals = true, onlyReferrals = false }: ProfileSettingsProps) {
  const { logout, linkTwitter, user } = usePrivy();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const authFetch = useAuthFetch();

  // Fetch referral stats
  const { data: referralStats, isLoading: referralStatsLoading } = useQuery<ReferralStats>({
    queryKey: ["referral-stats"],
    queryFn: async () => {
      const res = await authFetch("/api/me/referral-stats");
      if (!res.ok) throw new Error("Failed to fetch referral stats");
      return res.json();
    },
    enabled: onlyReferrals || showReferrals,
  });

  // Profile editing state
  const [handle, setHandle] = useState(profile.handle || "");
  const [name, setName] = useState(profile.name || "");
  const [profileImageUrl, setProfileImageUrl] = useState(profile.profileImageUrl || "");
  const [bannerImageUrl, setBannerImageUrl] = useState(profile.bannerImageUrl || "");
  const [handleCheck, setHandleCheck] = useState<HandleCheckResult | null>(null);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  
  // Default banner URL
  const DEFAULT_BANNER_URL = "https://markets.vault777.com/vault777markets.png";

  // Track if form has changes
  const hasChanges = 
    handle !== (profile.handle || "") ||
    name !== (profile.name || "") ||
    profileImageUrl !== (profile.profileImageUrl || "") ||
    bannerImageUrl !== (profile.bannerImageUrl || "");

  // Debounced handle availability check
  const checkHandleAvailability = useCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setHandleCheck(null);
      return;
    }

    // Skip check if it's the current handle
    if (value.toLowerCase() === profile.handle?.toLowerCase()) {
      setHandleCheck({ available: true, reason: "This is your current username" });
      return;
    }

    setIsCheckingHandle(true);
    try {
      const res = await authFetch(`/api/me/check-handle?handle=${encodeURIComponent(value)}`);
      if (res.ok) {
        const data = await res.json();
        setHandleCheck(data);
      }
    } catch {
      setHandleCheck(null);
    } finally {
      setIsCheckingHandle(false);
    }
  }, [profile.handle]);

  // Debounce handle check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (handle && handle !== profile.handle) {
        checkHandleAvailability(handle);
      } else if (!handle) {
        setHandleCheck(null);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [handle, profile.handle, checkHandleAvailability]);

  // Save profile mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { handle?: string | null; name?: string | null; profileImageUrl?: string | null; bannerImageUrl?: string | null }) => {
      const res = await authFetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save profile");
      }
      return res.json();
    },
    onSuccess: () => {
      // Invalidate profile queries
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });

  const handleSave = async () => {
    // Validate handle if changed
    if (handle !== (profile.handle || "") && handleCheck && !handleCheck.available) {
      return;
    }

    const updateData: { handle?: string | null; name?: string | null; profileImageUrl?: string | null; bannerImageUrl?: string | null } = {};
    
    if (handle !== (profile.handle || "")) {
      updateData.handle = handle || null;
    }
    if (name !== (profile.name || "")) {
      updateData.name = name || null;
    }
    if (profileImageUrl !== (profile.profileImageUrl || "")) {
      updateData.profileImageUrl = profileImageUrl || null;
    }
    if (bannerImageUrl !== (profile.bannerImageUrl || "")) {
      updateData.bannerImageUrl = bannerImageUrl || null;
    }

    if (Object.keys(updateData).length > 0) {
      await saveMutation.mutateAsync(updateData);
    }
  };

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  // Use handle for nicer referral links, fall back to referral code
  const referralLink = `${baseUrl}/r/${profile.handle || profile.referralCode}`;

  const handleCopyReferral = async () => {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(
      `Join me on Vault Markets! Trade predictions on sports, crypto, politics & more. Start with $10K virtual credits 🎯\n\n`
    );
    const url = encodeURIComponent(referralLink);
    window.open(
      `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      "_blank",
      "width=550,height=420"
    );
  };

  const hasTwitter = user?.twitter;
  const friendsInvited = profile._count?.referralsGiven ?? 0;

  // Determine if save button should be enabled
  const canSave = hasChanges && 
    !saveMutation.isPending && 
    (!handle || handle.length >= 3) &&
    (handle === (profile.handle || "") || (handleCheck?.available ?? true));

  // Validate if the profile image URL is valid
  const isValidImageUrl = (url: string): boolean => {
    if (!url) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const shouldShowImage = profileImageUrl && isValidImageUrl(profileImageUrl);
  const shouldShowBanner = bannerImageUrl && isValidImageUrl(bannerImageUrl);
  const displayBannerUrl = shouldShowBanner ? bannerImageUrl : DEFAULT_BANNER_URL;
  
  // Track if banner has changes (separate from profile changes for referral section)
  const hasBannerChanges = bannerImageUrl !== (profile.bannerImageUrl || "");
  
  // Save banner mutation (for referrals section)
  const saveBannerMutation = useMutation({
    mutationFn: async (newBannerUrl: string | null) => {
      const res = await authFetch("/api/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bannerImageUrl: newBannerUrl }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save banner");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
  
  const handleSaveBanner = async () => {
    await saveBannerMutation.mutateAsync(bannerImageUrl || null);
  };

  // If only showing referrals, render just that section
  if (onlyReferrals) {
    return (
      <div className="space-y-6">
        {/* Two column layout for referral link and volume */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Referral Link Section */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Referral Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  value={referralLink}
                  readOnly
                  className="bg-card border-border font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleCopyReferral}
                  className="flex-shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this link to invite friends and earn rewards
              </p>
            </div>

            {/* Share buttons */}
            <div className="grid grid-cols-2 gap-3">
              <Button 
                onClick={handleCopyReferral} 
                variant="outline"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Link
                  </>
                )}
              </Button>
              <Button
                onClick={handleShareTwitter}
                className="bg-black hover:bg-black/80 text-white"
              >
                <Twitter className="h-4 w-4 mr-2" />
                Share on X
              </Button>
            </div>

            {/* Referral code and friends count */}
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-sm text-muted-foreground">Your referral code</span>
                  <code className="block px-3 py-1.5 bg-card border border-border rounded-md font-mono text-sm font-medium w-fit">
                    {profile.handle || profile.referralCode}
                  </code>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card border border-border">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold text-lg">{friendsInvited}</span>
                  <span className="text-sm text-muted-foreground">invited</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Total Referred Volume */}
          <div className="flex flex-col justify-center p-6 rounded-xl border border-border bg-card/50">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Total Volume from Referrals</span>
              </div>
              <div className="flex items-baseline gap-1">
                {referralStatsLoading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                ) : (
                  <span className="text-4xl font-bold">
                    ${(referralStats?.totalReferredVolume ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Combined trading volume from all users you&apos;ve referred
              </p>
            </div>
          </div>
        </div>

        {/* Banner Image Section */}
        <div className="space-y-4 pt-6 border-t border-border">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Social Share Banner</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              This image will be shown when your referral link or captain link is shared on social media (Twitter/X, Discord, etc.)
            </p>
          </div>
          
          {/* Banner Preview */}
          <div className="relative w-full aspect-[3/1] rounded-lg overflow-hidden border border-border bg-card">
            <Image
              src={displayBannerUrl}
              alt="Referral banner preview"
              fill
              className="object-cover"
              onError={() => setBannerImageUrl("")}
            />
            {!shouldShowBanner && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <span className="text-xs text-white/80 bg-black/50 px-2 py-1 rounded">
                  Default Banner
                </span>
              </div>
            )}
          </div>
          
          {/* Banner URL Input */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Custom Banner URL</Label>
            <div className="flex items-center gap-2">
              <Input
                value={bannerImageUrl}
                onChange={(e) => setBannerImageUrl(e.target.value)}
                placeholder="https://example.com/your-banner.jpg"
                className="bg-card border-border"
              />
              <Button
                onClick={handleSaveBanner}
                disabled={!hasBannerChanges || saveBannerMutation.isPending}
                className="flex-shrink-0"
              >
                {saveBannerMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saveBannerMutation.isSuccess && !hasBannerChanges ? (
                  <Check className="h-4 w-4" />
                ) : (
                  "Save"
                )}
              </Button>
            </div>
            {bannerImageUrl && !isValidImageUrl(bannerImageUrl) && (
              <p className="text-xs text-destructive">Please enter a valid URL</p>
            )}
            <p className="text-xs text-muted-foreground">
              Recommended size: <span className="font-medium">1500×500px</span> (Twitter banner specs). Used for both referral and captain links. Leave empty to use the default Vault Markets banner.
            </p>
          </div>
          
          {saveBannerMutation.isError && (
            <p className="text-sm text-destructive">
              {saveBannerMutation.error.message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-x-12 gap-y-8">
        {/* Profile Section */}
        <div className="space-y-6">
          <div className="flex items-start gap-6">
            <div className="relative h-20 w-20 rounded-full overflow-hidden bg-gradient-to-br from-orange-400 via-green-400 to-blue-400 flex-shrink-0">
              {shouldShowImage ? (
                <Image
                  src={profileImageUrl}
                  alt="Profile"
                  fill
                  className="object-cover"
                  onError={() => setProfileImageUrl("")}
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <User className="h-9 w-9 text-white/70" />
                </div>
              )}
            </div>
            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Profile Image URL</Label>
                <Input
                  value={profileImageUrl}
                  onChange={(e) => setProfileImageUrl(e.target.value)}
                  placeholder="https://example.com/your-photo.jpg"
                  className="bg-card border-border"
                />
                {profileImageUrl && !isValidImageUrl(profileImageUrl) && (
                  <p className="text-xs text-destructive">Please enter a valid URL</p>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Username */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Username</Label>
              <div className="relative">
                <Input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="your_username"
                  className={cn(
                    "bg-card border-border pr-10",
                    handleCheck && !handleCheck.available && "border-red-500 focus-visible:ring-red-500"
                  )}
                  maxLength={20}
                />
                {isCheckingHandle && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {!isCheckingHandle && handleCheck && handle && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {handleCheck.available ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <span className="text-xs text-red-500">✕</span>
                    )}
                  </div>
                )}
              </div>
              {handleCheck && !handleCheck.available && (
                <p className="text-xs text-red-500">{handleCheck.reason}</p>
              )}
              {handle && handle.length < 3 && (
                <p className="text-xs text-muted-foreground">Min 3 characters</p>
              )}
            </div>

            {/* Display Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Display Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Name"
                className="bg-card border-border"
                maxLength={50}
              />
            </div>
          </div>

          {handle && profile.handle && (
            <p className="text-xs text-muted-foreground">
              Profile URL: {baseUrl}/u/{handle}
            </p>
          )}

          {/* Save Button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleSave}
              disabled={!canSave}
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : saveMutation.isSuccess ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Saved!
                </>
              ) : (
                "Save Changes"
              )}
            </Button>

            {saveMutation.isError && (
              <p className="text-sm text-red-500">
                {saveMutation.error.message}
              </p>
            )}
          </div>
        </div>

        {/* Account Section */}
        <div className="space-y-6">
          <div className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input
                value={profile.email || "Not connected"}
                disabled
                className="bg-card border-border"
              />
            </div>

            {/* Twitter */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">X (Twitter)</Label>
              {hasTwitter ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={`@${user.twitter?.username}`}
                    disabled
                    className="bg-card border-border flex-1"
                  />
                  <a
                    href={`https://x.com/${user.twitter?.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center h-10 w-10 rounded-md border border-border hover:bg-muted transition-colors flex-shrink-0"
                  >
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </a>
                </div>
              ) : (
                <Button onClick={linkTwitter} variant="outline" className="w-full">
                  <Twitter className="h-4 w-4 mr-2" />
                  Connect X Account
                </Button>
              )}
            </div>
          </div>

          {/* Captain (KOL) Selection */}
          <div className="pt-4 border-t border-border">
            <CaptainSelector />
          </div>

          <div className="pt-4 border-t border-border">
            <Button 
              variant="ghost" 
              onClick={logout} 
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 w-full justify-start"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
