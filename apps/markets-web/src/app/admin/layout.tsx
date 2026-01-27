import { redirect } from "next/navigation";
import { getSessionUser } from "@vault/auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user || user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <AdminSidebar user={user} />
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
