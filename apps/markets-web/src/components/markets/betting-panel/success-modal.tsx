import { Button, Dialog, DialogContent } from "@vault/ui";
import { Check, Loader2, Sparkles, Copy, Download } from "lucide-react";
import { XIcon } from "../x-icon";
import { BettingTicket } from "../betting-ticket";
import type { Market, Outcome } from "@vault/database";

interface SuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  market: Market & { outcomes: Outcome[] };
  outcomeA: Outcome | undefined;
  outcomeB: Outcome | undefined;
  confirmedOutcome: "A" | "B" | null;
  confirmedBetAmount: number;
  profile?: {
    name?: string | null;
    handle?: string | null;
    profileImageUrl?: string | null;
  } | null;
  ticketRef: React.RefObject<HTMLDivElement>;
  isGeneratingImage: boolean;
  copied: boolean;
  onShareOnX: () => void;
  onDownload: () => void;
  onCopyLink: () => void;
}

export function SuccessModal({
  open,
  onOpenChange,
  market,
  outcomeA,
  outcomeB,
  confirmedOutcome,
  confirmedBetAmount,
  profile,
  ticketRef,
  isGeneratingImage,
  copied,
  onShareOnX,
  onDownload,
  onCopyLink,
}: SuccessModalProps) {
  if (!confirmedOutcome) return null;

  const confirmedOutcomeData = confirmedOutcome === "A" ? outcomeA : outcomeB;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg overflow-hidden p-0">
        <div className="p-6 space-y-6">
          {/* Success header */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-purple-400" />
              <h2 className="text-xl font-bold">Bet Confirmed!</h2>
              <Sparkles className="h-5 w-5 text-purple-400" />
            </div>
          </div>

          {/* Ticket Preview */}
          {confirmedOutcomeData && (
            <div className="flex justify-center">
              <BettingTicket
                ref={ticketRef}
                market={market}
                outcome={confirmedOutcomeData}
                amount={confirmedBetAmount}
                userName={profile?.name}
                userHandle={profile?.handle}
                userAvatar={profile?.profileImageUrl}
              />
            </div>
          )}

          {/* Action buttons */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground text-center">Share your betting ticket</p>
            <div className="flex gap-2">
              <Button
                onClick={onShareOnX}
                disabled={isGeneratingImage}
                className="flex-1 gap-2 bg-black hover:bg-black/80 text-white"
              >
                {isGeneratingImage ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XIcon className="h-4 w-4" />
                )}
                Share on X
              </Button>
              <Button onClick={onDownload} disabled={isGeneratingImage} variant="outline" className="gap-2">
                {isGeneratingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
              <Button onClick={onCopyLink} variant="outline" className="gap-2">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Close button */}
          <Button onClick={() => onOpenChange(false)} variant="ghost" className="w-full text-muted-foreground">
            Continue Browsing
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

