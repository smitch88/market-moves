"use client";

import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { format } from "date-fns";
import { CalendarDays, User } from "lucide-react";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Badge,
  Skeleton,
} from "@vault/ui";
import { ProfileActivity } from "./profile-activity";
import { ProfileSettings } from "./profile-settings";

interface ProfileContentProps {
  userId: string;
}

async function fetchProfile() {
  const res = await fetch("/api/me");
  if (!res.ok) return null;
  return res.json();
}

async function fetchUserActivity(userId: string) {
  const res = await fetch(`/api/users/${userId}/activity`);
  if (!res.ok) return { bets: [], positions: [] };
  return res.json();
}

export function ProfileContent({ userId }: ProfileContentProps) {
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") || "activity";

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: fetchProfile,
  });

  const { data: activity, isLoading: activityLoading } = useQuery({
    queryKey: ["user-activity", userId],
    queryFn: () => fetchUserActivity(userId),
  });

  if (profileLoading) {
    return <ProfileContentSkeleton />;
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Profile not found</p>
      </div>
    );
  }

  const displayName = profile.name || profile.handle || "Anonymous";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile header */}
      <GlassCard>
        <GlassCardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            {/* Avatar */}
            <div className="relative h-24 w-24 rounded-full overflow-hidden bg-muted border-4 border-primary/20">
              {profile.profileImageUrl ? (
                <Image
                  src={profile.profileImageUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center">
                  <User className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold">{displayName}</h1>
              {profile.handle && (
                <p className="text-muted-foreground">@{profile.handle}</p>
              )}
              <div className="flex items-center justify-center sm:justify-start gap-4 mt-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <CalendarDays className="h-4 w-4" />
                  <span>Joined recently</span>
                </div>
                {profile.role === "ADMIN" && <Badge variant="default">Admin</Badge>}
              </div>
            </div>

            {/* Balance */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-3xl font-bold text-[#df2421]">
                ${profile.balance.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t border-border">
            <div className="text-center">
              <p className="text-2xl font-bold">{activity?.positions?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Positions</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{activity?.bets?.length || 0}</p>
              <p className="text-sm text-muted-foreground">Total Bets</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">$0</p>
              <p className="text-sm text-muted-foreground">Profit/Loss</p>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="activity">
          <ProfileActivity bets={activity?.bets || []} isLoading={activityLoading} />
        </TabsContent>
        <TabsContent value="settings">
          <ProfileSettings profile={profile} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProfileContentSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <GlassCard>
        <GlassCardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="text-center space-y-2">
              <Skeleton className="h-4 w-16 mx-auto" />
              <Skeleton className="h-10 w-24" />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </div>
  );
}
