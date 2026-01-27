"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Button,
  Input,
  Label,
  Separator,
} from "@vault/ui";
import { Copy, Check, ExternalLink, Twitter, Users, Gift } from "lucide-react";

interface ProfileSettingsProps {
  profile: {
    id: string;
    email: string | null;
    handle: string | null;
    twitterSubject?: string | null;
    role: string;
    referralCode: string;
    _count?: {
      referralsGiven?: number;
    };
  };
}

export function ProfileSettings({ profile }: ProfileSettingsProps) {
  const { logout, linkTwitter, user } = usePrivy();
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const referralLink = `${baseUrl}/r/${profile.referralCode}`;

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
  const referralCount = profile._count?.referralsGiven ?? 0;

  return (
    <div className="space-y-6">
      {/* Account settings */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Account</h2>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input 
              value={profile.email || "Not connected"} 
              disabled 
              className="font-mono"
            />
            {!profile.email && (
              <p className="text-xs text-muted-foreground">
                No email linked to this account
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>X (Twitter)</Label>
            {hasTwitter ? (
              <div className="flex items-center gap-2">
                <Input value={`@${user.twitter?.username}`} disabled />
                <Button variant="ghost" size="icon" asChild>
                  <a
                    href={`https://x.com/${user.twitter?.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            ) : (
              <Button onClick={linkTwitter} variant="outline">
                Connect X Account
              </Button>
            )}
          </div>

          <div className="space-y-2">
            <Label>Account Role</Label>
            <div className="flex items-center gap-2">
              <Input 
                value={profile.role} 
                disabled 
                className={profile.role === "ADMIN" ? "text-primary font-medium" : ""}
              />
              {profile.role === "ADMIN" && (
                <span className="px-2 py-0.5 text-xs font-medium rounded bg-primary/20 text-primary">
                  Admin
                </span>
              )}
            </div>
          </div>

          <Separator />

          <Button variant="destructive" onClick={logout}>
            Sign Out
          </Button>
        </GlassCardContent>
      </GlassCard>

      {/* Referral */}
      <GlassCard>
        <GlassCardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Gift className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Invite Friends</h2>
              <p className="text-sm text-muted-foreground">
                Earn bonus entries when friends join and bet!
              </p>
            </div>
          </div>
        </GlassCardHeader>
        <GlassCardContent className="space-y-6">
          {/* Stats */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{referralCount}</p>
              <p className="text-sm text-muted-foreground">
                {referralCount === 1 ? "Friend invited" : "Friends invited"}
              </p>
            </div>
          </div>

          {/* Referral Link */}
          <div className="space-y-3">
            <Label>Your Referral Link</Label>
            <div className="flex items-center gap-2">
              <Input 
                value={referralLink} 
                readOnly 
                className="font-mono text-sm bg-muted/30" 
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={handleCopyReferral}
                className="flex-shrink-0"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-outcome-yes" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2">
            <Button 
              onClick={handleCopyReferral} 
              variant="outline" 
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-outcome-yes" />
                  Copied!
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
              className="flex-1 bg-[#1DA1F2] hover:bg-[#1a8cd8]"
            >
              <Twitter className="h-4 w-4 mr-2" />
              Share on X
            </Button>
          </div>

          {/* Code display */}
          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Referral Code</span>
              <code className="px-2 py-1 rounded bg-muted font-mono text-sm">
                {profile.referralCode}
              </code>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
