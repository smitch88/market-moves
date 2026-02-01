import { Input } from "@vault/ui";
import { Loader2 } from "lucide-react";
import { XIcon } from "../x-icon";
import { useState } from "react";

interface VerifyStepProps {
  pendingBet?: {
    id: string;
    amount: number;
    outcomeIndex: number;
    outcomeLabel?: string;
  } | null;
  selectedOutcome: number | null;
  outcomes: string[];
  tweetUrl: string;
  onTweetUrlChange: (url: string) => void;
  onOpenTweetIntent: () => void;
  onVerify: (method: "timeline" | "url") => void;
  isLoading: boolean;
}

export function VerifyStep({
  pendingBet,
  selectedOutcome,
  outcomes,
  tweetUrl,
  onTweetUrlChange,
  onOpenTweetIntent,
  onVerify,
  isLoading,
}: VerifyStepProps) {
  const [hasOpenedTweet, setHasOpenedTweet] = useState(false);
  const selectedOutcomeLabel = selectedOutcome !== null ? outcomes[selectedOutcome] : "";
  const selectedOutcomeColor = selectedOutcome === 0 ? "text-outcome-yes" : "text-outcome-no";

  const handleOpenTweet = () => {
    onOpenTweetIntent();
    setHasOpenedTweet(true);
  };

  return (
    <div className="space-y-4">
      {/* Pending bet summary */}
      {pendingBet && (
        <div className="p-3 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center justify-between">
            <div className={`text-sm font-medium ${selectedOutcomeColor}`}>
              {pendingBet.outcomeLabel || selectedOutcomeLabel}
            </div>
            <div className="text-sm font-semibold text-foreground">${pendingBet.amount.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Post on X button - only show if not opened yet */}
      {!hasOpenedTweet && (
        <>
          <p className="text-sm text-muted-foreground">
            Post your prediction on X to confirm your bet.
          </p>
          <button
            onClick={handleOpenTweet}
            className="w-full h-11 rounded-xl bg-black text-white hover:bg-black/90 transition-all duration-200 font-medium flex items-center justify-center gap-2"
          >
            <XIcon className="h-4 w-4" />
            Open X to Post
          </button>
        </>
      )}

      {/* Verification */}
      {hasOpenedTweet && (
        <p className="text-sm text-muted-foreground">
          After posting, verify your tweet below.
        </p>
      )}

      <div className="space-y-3">
        <button
          onClick={() => onVerify("timeline")}
          disabled={isLoading}
          className="w-full h-11 rounded-xl bg-muted border border-border text-foreground hover:bg-accent transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto" />
          ) : (
            "Verify Post"
          )}
        </button>

        <div className="flex gap-2 items-center">
          <Input
            placeholder="Or paste tweet URL"
            value={tweetUrl}
            onChange={(e) => onTweetUrlChange(e.target.value)}
            className="flex-1 h-11 bg-background border-border"
          />
          <button
            onClick={() => onVerify("url")}
            disabled={!tweetUrl || isLoading}
            className="h-11 px-4 rounded-xl bg-muted border border-border text-foreground hover:bg-accent transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center justify-center"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
          </button>
        </div>
      </div>
    </div>
  );
}
