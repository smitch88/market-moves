import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@vault/auth";
import { prisma } from "@vault/database";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

// Force dynamic rendering for all admin routes (auth + db access)
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessionUser = await getSessionUser();

  if (!sessionUser || sessionUser.role !== "ADMIN") {
    redirect("/");
  }

  // Fetch additional user details for the admin card
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      handle: true,
      email: true,
      profileImageUrl: true,
      role: true,
      balance: true,
      xp: true,
      twitterSubject: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  // Convert Decimal to number for balance and map field names
  const adminUser = {
    id: user.id,
    name: user.name,
    handle: user.handle,
    email: user.email,
    avatarUrl: user.profileImageUrl,
    role: user.role,
    balance: Number(user.balance),
    xp: user.xp,
    twitterId: user.twitterSubject,
  };

  return (
    <div className="h-screen overflow-hidden grid-bg">
      <div className="flex h-full">
        <AdminSidebar user={adminUser} />
        <main className="flex-1 min-w-0 overflow-y-auto">
          {/* Add top padding on mobile for the fixed header bar */}
          <div className="pt-14 lg:pt-0 min-h-full">
            <div className="p-4 sm:p-6 lg:p-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
