import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { ProfileContent } from "@/components/profile/profile-content";
import { ProfileSkeleton } from "@/components/profile/profile-skeleton";
import { getSessionUser } from "@vault/auth";

export default async function ProfilePage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/");
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfileContent userId={user.id} />
        </Suspense>
      </main>
    </div>
  );
}
