import { Button } from "@vault/ui";
import type { Outcome } from "@vault/database";

interface SelectOutcomeStepProps {
  outcomeA: Outcome | undefined;
  outcomeB: Outcome | undefined;
  stats: {
    percentA: number;
    percentB: number;
  };
  authenticated: boolean;
  onSelect: (key: "A" | "B") => void;
  onLogin: () => void;
}

export function SelectOutcomeStep({
  outcomeA,
  outcomeB,
  stats,
  authenticated,
  onSelect,
  onLogin,
}: SelectOutcomeStepProps) {
  return (
    <>
      <p className="text-sm text-muted-foreground mb-3">Pick your prediction:</p>
      <div className="flex gap-3">
        <button
          onClick={() => onSelect("A")}
          className="flex-1 h-14 rounded-xl font-semibold text-base transition-all duration-200 flex flex-col items-center justify-center gap-1 bg-outcome-yes/[0.08] border border-outcome-yes/30 text-outcome-yes hover:bg-outcome-yes/[0.15] hover:border-outcome-yes/50 active:scale-[0.98]"
        >
          <span className="text-sm">{outcomeA?.label}</span>
          <span className="text-xs font-medium text-outcome-yes/70">{stats.percentA}%</span>
        </button>
        <button
          onClick={() => onSelect("B")}
          className="flex-1 h-14 rounded-xl font-semibold text-base transition-all duration-200 flex flex-col items-center justify-center gap-1 bg-outcome-no/[0.08] border border-outcome-no/30 text-outcome-no hover:bg-outcome-no/[0.15] hover:border-outcome-no/50 active:scale-[0.98]"
        >
          <span className="text-sm">{outcomeB?.label}</span>
          <span className="text-xs font-medium text-outcome-no/70">{stats.percentB}%</span>
        </button>
      </div>
      {!authenticated && (
        <Button onClick={onLogin} className="w-full">
          Sign in to bet
        </Button>
      )}
    </>
  );
}

