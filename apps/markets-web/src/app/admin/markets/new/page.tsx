"use client";

import { useState, useCallback } from "react";
import { Badge } from "@vault/ui";
import { Copy } from "lucide-react";
import { MarketForm } from "@/components/admin/market-form";
import { CloneSelector, type MarketForClone } from "@/components/admin";

// Helper to parse outcomes from JSON
function parseOutcomes(outcomesJson: string): string[] {
  try {
    return JSON.parse(outcomesJson);
  } catch {
    return ["Yes", "No"];
  }
}

export default function NewMarketPage() {
  const [showCloneSelector, setShowCloneSelector] = useState(true);
  const [clonedFrom, setClonedFrom] = useState<MarketForClone | null>(null);
  const [initialData, setInitialData] = useState<{
    question: string;
    outcome0Label: string;
    outcome1Label: string;
    detailsMarkdown: string;
    resolutionSourceUrl: string;
    feeBps: string;
    seed0: string;
    seed1: string;
  } | null>(null);

  // Handle clone selection
  const handleCloneSelect = useCallback((data: MarketForClone | null) => {
    setShowCloneSelector(false);
    
    if (data) {
      setClonedFrom(data);
      const outcomes = parseOutcomes(data.outcomes);
      
      setInitialData({
        question: `${data.question} (Copy)`,
        outcome0Label: outcomes[0] || "Yes",
        outcome1Label: outcomes[1] || "No",
        detailsMarkdown: data.detailsMarkdown || "",
        resolutionSourceUrl: data.resolutionSourceUrl || "",
        feeBps: data.feeBps?.toString() || "100",
        seed0: data.seed0?.toString() || "100000",
        seed1: data.seed1?.toString() || "100000",
      });
    }
  }, []);

  // Show clone selector first
  if (showCloneSelector) {
    return (
      <div className="max-w-4xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Create Market</h1>
          <p className="text-muted-foreground">Create a new prediction market</p>
        </div>

        <CloneSelector
          type="market"
          onSelect={(data) => handleCloneSelect(data as MarketForClone | null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Create Market</h1>
          <p className="text-muted-foreground">Create a new prediction market</p>
        </div>
        {clonedFrom && (
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Copy className="h-3 w-3" />
            Cloned from market
          </Badge>
        )}
      </div>

      <MarketForm initialCloneData={initialData} />
    </div>
  );
}
