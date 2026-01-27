import { Button } from "@vault/ui";

interface SelectOutcomeStepProps {
  outcomes: string[];
  stats: {
    percent0?: number;
    percent1?: number;
    percentA?: number;
    percentB?: number;
  };
  authenticated: boolean;
  onSelect: (index: number) => void;
  onLogin: () => void;
}

export function SelectOutcomeStep({
  outcomes,
  stats,
  authenticated,
  onSelect,
  onLogin,
}: SelectOutcomeStepProps) {
  // Support both new and legacy stat names
  const percent0 = stats.percent0 ?? stats.percentA ?? 50;
  const percent1 = stats.percent1 ?? stats.percentB ?? 50;

  return (
    <>
      <p className="text-sm text-muted-foreground mb-3">Pick your prediction:</p>
      <div className="flex gap-3">
        <button
          onClick={() => onSelect(0)}
          className="flex-1 h-14 rounded-xl font-semibold text-base transition-all duration-200 flex flex-col items-center justify-center gap-1 bg-outcome-yes/[0.08] border border-outcome-yes/30 text-outcome-yes hover:bg-outcome-yes/[0.15] hover:border-outcome-yes/50 active:scale-[0.98]"
        >
          <span className="text-sm">{outcomes[0]}</span>
          <span className="text-xs font-medium text-outcome-yes/70">{percent0}%</span>
        </button>
        <button
          onClick={() => onSelect(1)}
          className="flex-1 h-14 rounded-xl font-semibold text-base transition-all duration-200 flex flex-col items-center justify-center gap-1 bg-outcome-no/[0.08] border border-outcome-no/30 text-outcome-no hover:bg-outcome-no/[0.15] hover:border-outcome-no/50 active:scale-[0.98]"
        >
          <span className="text-sm">{outcomes[1]}</span>
          <span className="text-xs font-medium text-outcome-no/70">{percent1}%</span>
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
