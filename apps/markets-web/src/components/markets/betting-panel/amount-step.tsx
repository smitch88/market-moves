import { Input, Label } from "@vault/ui";
import { Loader2 } from "lucide-react";

interface AmountStepProps {
  selectedOutcome: number | null;
  outcomes: string[];
  amount: string;
  balance: number;
  onAmountChange: (amount: string) => void;
  onBack: () => void;
  onContinue: () => void;
  isLoading: boolean;
}

export function AmountStep({
  selectedOutcome,
  outcomes,
  amount,
  balance,
  onAmountChange,
  onBack,
  onContinue,
  isLoading,
}: AmountStepProps) {
  const selectedOutcomeLabel = selectedOutcome !== null ? outcomes[selectedOutcome] : "";
  const selectedOutcomeColor = selectedOutcome === 0 ? "text-outcome-yes" : "text-outcome-no";

  return (
    <>
      <div className="space-y-4">
        {/* Selected outcome preview */}
        <div className="text-center py-2 px-4 rounded-lg bg-muted/30 border border-border">
          <div className="text-xs text-muted-foreground mb-1">Your Pick</div>
          <div className={`text-sm font-semibold ${selectedOutcomeColor}`}>{selectedOutcomeLabel}</div>
        </div>

        {/* Amount input */}
        <div className="space-y-3">
          <Label className="text-sm">Bet Amount</Label>
          <Input
            type="number"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            max={balance}
            min={1}
            className="h-12 text-lg text-center font-semibold bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-ring"
          />
          <div className="grid grid-cols-4 gap-2">
            {[50, 100, 200, balance].map((preset) => {
              const isSelected = amount === String(Math.min(preset, balance));
              return (
                <button
                  key={preset}
                  onClick={() => onAmountChange(String(Math.min(preset, balance)))}
                  className={`h-10 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isSelected
                      ? "bg-primary text-primary-foreground border border-primary"
                      : "bg-muted border border-border text-foreground/70 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {preset === balance ? "Max" : `$${preset.toLocaleString()}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 h-11 rounded-xl bg-muted border border-border text-foreground hover:bg-accent transition-all duration-200 font-medium active:scale-[0.98]"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={!amount || parseInt(amount, 10) > balance || isLoading}
          className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Continue"}
        </button>
      </div>
    </>
  );
}
