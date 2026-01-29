"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Button, Input, Label } from "@vault/ui";
import { Copy, Check, ExternalLink, Twitter, LogOut, Users } from "lucide-react";

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
  const friendsInvited = profile._count?.referralsGiven ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-6xl">
      {/* Account Section */}
      <div className="border border-border rounded-xl p-6">
        <h3 className="font-semibold text-lg mb-6">Account</h3>
        
        <div className="space-y-6">
          {/* Email */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Email</Label>
            <Input
              value={profile.email || "Not connected"}
              disabled
              className="bg-muted/50 border-border"
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
                  className="bg-muted/50 border-border"
                />
                <a
                  href={`https://x.com/${user.twitter?.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center h-10 w-10 rounded-md border border-border hover:bg-muted transition-colors"
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

        <div className="mt-8 pt-6 border-t border-border">
          <Button 
            variant="ghost" 
            onClick={logout} 
            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </div>

      {/* Referral Section */}
      <div className="border border-border rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-lg">Invite Friends</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Share your link and earn rewards when friends join
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/50">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-bold text-lg">{friendsInvited}</span>
            <span className="text-sm text-muted-foreground">invited</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Referral Link */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Your referral link</Label>
            <div className="flex items-center gap-2">
              <Input
                value={referralLink}
                readOnly
                className="bg-muted/50 border-border font-mono text-sm"
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
          </div>

          {/* Share buttons */}
          <div className="flex gap-3">
            <Button 
              onClick={handleCopyReferral} 
              variant="outline"
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-500" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy link
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

          {/* Referral code */}
          <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-muted/30 border border-border">
            <span className="text-sm text-muted-foreground">Referral code</span>
            <code className="px-2 py-1 bg-background rounded font-mono text-sm font-medium">
              {profile.referralCode}
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}
