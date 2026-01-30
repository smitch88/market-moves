"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { Zap } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { QuickBetModal } from "./quick-bet-modal";

interface QuickBetButtonProps {
  eventId: string;
  eventTitle: string;
  className?: string;
}

export function QuickBetButton({ eventId, eventTitle, className }: QuickBetButtonProps) {
  const { authenticated, login } = usePrivy();
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!authenticated) {
      login();
      return;
    }
    
    setModalOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold",
          "bg-primary/90 text-primary-foreground hover:bg-primary",
          "transition-all duration-200 hover:scale-105 active:scale-95",
          "shadow-lg shadow-primary/25",
          className
        )}
        title="Quick Bet"
      >
        <Zap className="h-3.5 w-3.5" />
        <span>Quick Bet</span>
      </button>

      <QuickBetModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        eventId={eventId}
        eventTitle={eventTitle}
      />
    </>
  );
}
