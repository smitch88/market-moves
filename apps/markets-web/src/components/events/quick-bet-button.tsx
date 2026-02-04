"use client";

import { useState } from "react";
import { useSession, signIn } from "@vault/auth/client";
import { Zap } from "lucide-react";
import { cn } from "@vault/ui/lib/utils";
import { QuickBetModal } from "./quick-bet-modal";

interface QuickBetButtonProps {
  eventId: string;
  eventTitle: string;
  className?: string;
}

export function QuickBetButton({ eventId, eventTitle, className }: QuickBetButtonProps) {
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const [modalOpen, setModalOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!authenticated) {
      signIn("twitter");
      return;
    }
    
    setModalOpen(true);
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1 xs:gap-1.5 px-2 xs:px-3 py-1.5 rounded-full text-[11px] xs:text-xs font-semibold",
          "bg-primary/90 text-primary-foreground hover:bg-primary",
          "transition-all duration-200 hover:scale-105 active:scale-95",
          "shadow-lg shadow-primary/25",
          className
        )}
        title="Quick Bet"
      >
        <Zap className="h-3 w-3 xs:h-3.5 xs:w-3.5" />
        <span className="hidden xs:inline">Quick Bet</span>
        <span className="xs:hidden">Bet</span>
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
