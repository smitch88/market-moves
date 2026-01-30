"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn, Badge, Button, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@vault/ui";
import {
  LayoutDashboard,
  BarChart3,
  Users,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Calendar,
  Tag,
  Shield,
  Sun,
  Moon,
  Share2,
  LogOut,
  Menu,
  X,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { useLogout } from "@privy-io/react-auth";

interface AdminSidebarProps {
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    email: string | null;
    avatarUrl: string | null;
    role: string;
    balance: number;
    xp: number;
    twitterId: string | null;
  };
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", icon: Calendar },
  { href: "/admin/markets", label: "Markets", icon: BarChart3 },
  { href: "/admin/bets", label: "Bets", icon: Receipt },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/xp", label: "XP Config", icon: Sparkles },
  { href: "/admin/requests", label: "Requests", icon: Lightbulb },
  { href: "/admin/social", label: "Social", icon: Share2 },
  { href: "/admin/tags", label: "Tags", icon: Tag },
];

export function AdminSidebar({ user }: AdminSidebarProps) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useLogout();

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Header with Vault Logo */}
      <div className={cn("border-b border-border/50 flex-shrink-0", collapsed && !isMobile ? "p-3" : "p-4")}>
        <div className={cn("flex items-center", collapsed && !isMobile ? "justify-center" : "justify-between", "mb-3")}>
          {collapsed && !isMobile ? (
            <img
              src="/logo.svg"
              alt="Vault"
              className="w-8 h-8"
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <img
                  src="/logo.svg"
                  alt="Vault"
                  className="w-8 h-8"
                />
                <div>
                  <h1 className="text-lg font-bold text-[#df2421]">VAULT</h1>
                  <p className="text-xs text-muted-foreground">Admin Panel</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* Theme Toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                  className="h-8 w-8 rounded-lg hover:bg-muted"
                >
                  <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                </Button>
                {/* Close button for mobile */}
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileOpen(false)}
                    className="h-8 w-8 rounded-lg hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Back to site link */}
        {collapsed && !isMobile ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/"
                className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors p-2 rounded-lg hover:bg-muted/50"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              Back to site
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/"
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Back to site</span>
          </Link>
        )}
      </div>

      {/* Navigation - Scrollable area */}
      <nav className={cn("space-y-1 flex-1 overflow-y-auto overflow-x-visible", collapsed && !isMobile ? "px-2 py-2" : "p-4")}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                "flex items-center text-sm font-medium transition-all",
                collapsed && !isMobile ? "justify-center p-3 rounded-lg" : "gap-3 px-3 py-2.5 rounded-xl",
                isActive
                  ? "bg-[#df2421] text-white"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {(!collapsed || isMobile) && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed && !isMobile) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Admin User Card - Fixed at bottom */}
      <div className={cn("border-t border-border/50 bg-background flex-shrink-0", collapsed && !isMobile ? "p-2" : "p-4")}>
        {collapsed && !isMobile ? (
          // Collapsed: Just show avatar
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex justify-center">
                {user.avatarUrl ? (
                  <Image
                    src={user.avatarUrl}
                    alt={user.name || user.handle || "Admin"}
                    width={40}
                    height={40}
                    className="rounded-full border-2 border-[#df2421]/50 cursor-pointer hover:border-[#df2421] transition-colors"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#df2421] to-[#df2421]/70 flex items-center justify-center cursor-pointer">
                    <Shield className="h-5 w-5 text-white" />
                  </div>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[200px]">
              <div className="space-y-1">
                <p className="font-semibold">{user.name || user.handle || "Admin"}</p>
                {user.handle && <p className="text-xs text-muted-foreground">@{user.handle}</p>}
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="default" className="bg-[#df2421] hover:bg-[#df2421] text-white text-xs px-1.5 py-0">
                    {user.role}
                  </Badge>
                  <span className="text-xs font-mono">${user.balance.toLocaleString()}</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ) : (
          // Expanded: Show full card
          <div className="bg-card/50 border border-border/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              {user.avatarUrl ? (
                <Image
                  src={user.avatarUrl}
                  alt={user.name || user.handle || "Admin"}
                  width={44}
                  height={44}
                  className="rounded-full border-2 border-[#df2421]/50"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#df2421] to-[#df2421]/70 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">
                  {user.name || user.handle || "Admin"}
                </p>
                {user.handle && (
                  <p className="text-xs text-muted-foreground truncate">
                    @{user.handle}
                  </p>
                )}
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t border-border/30 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Role</span>
                <Badge variant="default" className="bg-[#df2421] hover:bg-[#df2421] text-white text-xs px-2 py-0.5">
                  {user.role}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Balance</span>
                <span className="font-mono font-semibold text-[#df2421]">${user.balance.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">XP</span>
                <span className="font-mono font-semibold text-purple-400">{user.xp.toLocaleString()}</span>
              </div>
              {user.twitterId && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">X ID</span>
                  <span className="font-mono text-muted-foreground text-[10px]">{user.twitterId}</span>
                </div>
              )}
            </div>

            <button
              onClick={() => logout()}
              className="mt-4 w-full flex items-center justify-center gap-2 text-xs text-red-500 hover:text-red-400 transition-colors py-2 rounded-lg hover:bg-red-500/10"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <TooltipProvider delayDuration={0}>
      {/* Mobile Header Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-background border-b border-border/50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Vault" className="w-6 h-6" />
            <span className="font-bold text-[#df2421]">VAULT</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="h-8 w-8"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          {user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.name || "Admin"}
              width={32}
              height={32}
              className="rounded-full border border-border"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-[#df2421] flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar Drawer */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-background transition-transform duration-300 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent isMobile={true} />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex h-full flex-shrink-0 border-r border-border/50 bg-background flex-col transition-all duration-300 ease-in-out relative",
          collapsed ? "w-[72px]" : "w-64"
        )}
      >
        {/* Collapse Toggle Button - Desktop only */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="fixed top-1/2 z-50 w-6 h-6 rounded-full bg-background border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-300 shadow-sm"
              style={{ 
                transform: "translateY(-50%)",
                left: collapsed ? "60px" : "244px"
              }}
            >
              {collapsed ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expand sidebar" : "Collapse sidebar"}
          </TooltipContent>
        </Tooltip>

        <SidebarContent isMobile={false} />
      </aside>
    </TooltipProvider>
  );
}
