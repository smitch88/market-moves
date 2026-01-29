"use client";

import { cn } from "@vault/ui";
import { ReactNode } from "react";

interface ResponsiveTableProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper component that makes tables horizontally scrollable on mobile
 * while maintaining full width on desktop
 */
export function ResponsiveTable({ children, className }: ResponsiveTableProps) {
  return (
    <div className={cn("overflow-x-auto -mx-4 sm:mx-0", className)}>
      <div className="min-w-[640px] sm:min-w-0 px-4 sm:px-0">
        {children}
      </div>
    </div>
  );
}

interface MobileCardViewProps<T> {
  items: T[];
  renderCard: (item: T, index: number) => ReactNode;
  renderTable: () => ReactNode;
  className?: string;
}

/**
 * Component that shows cards on mobile and table on desktop
 */
export function MobileCardView<T>({
  items,
  renderCard,
  renderTable,
  className,
}: MobileCardViewProps<T>) {
  return (
    <>
      {/* Mobile Card View */}
      <div className={cn("sm:hidden space-y-3", className)}>
        {items.map((item, index) => renderCard(item, index))}
      </div>
      {/* Desktop Table View */}
      <div className="hidden sm:block">{renderTable()}</div>
    </>
  );
}

interface AdminPageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

/**
 * Responsive header component for admin pages
 */
export function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm sm:text-base text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  color?: string;
}

/**
 * Responsive stat card for dashboard
 */
export function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      {icon && (
        <div className={cn("p-2 sm:p-3 rounded-lg bg-muted", color)}>
          {icon}
        </div>
      )}
      <div>
        <p className="text-xl sm:text-2xl font-bold">{value}</p>
        <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
