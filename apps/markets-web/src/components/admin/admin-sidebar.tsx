"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@vault/ui";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  ChevronLeft,
} from "lucide-react";

interface AdminSidebarProps {
  user: {
    name: string | null;
    handle: string | null;
  };
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/markets", label: "Markets", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen border-r border-border bg-card">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <Link
          href="/"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="text-sm">Back to site</span>
        </Link>
        <div className="mt-4">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">
            {user.name || user.handle || "Admin"}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
