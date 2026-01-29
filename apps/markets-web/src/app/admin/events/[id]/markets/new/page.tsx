"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Button,
  Input,
  Label,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
} from "@vault/ui";
import { Loader2 } from "lucide-react";
import { TipTapEditor } from "@/components/admin/tiptap-editor";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function AdminNewMarketForEventPage({ params }: PageProps) {
  const { id: eventId } = use(params);
  const router = useRouter();

  // Fetch event info for display
  const { data: eventData } = useQuery({
    queryKey: ["adminEvent", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/events/${eventId}`);
      if (!res.ok) throw new Error("Failed to fetch event");
      return res.json();
    },
  });

  const event = eventData?.event;

  const [formData, setFormData] = useState({
    question: "",
    outcome0Label: "Yes",
    outcome1Label: "No",
    detailsMarkdown: "",
    resolutionSourceUrl: "",
    opensAt: "",
    closesAt: "",
    feeBps: "100",
    seed0: "1000",
    seed1: "1000",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch("/api/admin/markets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          question: data.question,
          outcomes: [data.outcome0Label, data.outcome1Label],
          detailsMarkdown: data.detailsMarkdown || undefined,
          resolutionSourceUrl: data.resolutionSourceUrl || undefined,
          opensAt: data.opensAt
            ? new Date(data.opensAt).toISOString()
            : undefined,
          closesAt: data.closesAt
            ? new Date(data.closesAt).toISOString()
            : undefined,
          feeBps: parseInt(data.feeBps, 10),
          seed0: parseInt(data.seed0, 10),
          seed1: parseInt(data.seed1, 10),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create market");
      }

      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/admin/markets/${data.market.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Add Market</h1>
        <p className="text-muted-foreground">
          {event ? `Adding to: ${event.title}` : "Loading..."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Market question */}
        <GlassCard variant="solid">
          <GlassCardHeader>
            <h2 className="text-lg font-semibold">Market Question</h2>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Question</Label>
              <Input
                id="question"
                name="question"
                value={formData.question}
                onChange={handleChange}
                placeholder="Who will win the Super Bowl?"
                required
              />
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Outcomes */}
        <GlassCard variant="solid">
          <GlassCardHeader>
            <h2 className="text-lg font-semibold">Outcomes</h2>
            <p className="text-sm text-muted-foreground">
              Define the two possible outcomes for this market
            </p>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outcome0Label">Outcome 1 Label</Label>
                <Input
                  id="outcome0Label"
                  name="outcome0Label"
                  value={formData.outcome0Label}
                  onChange={handleChange}
                  placeholder="Team A / Yes"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outcome1Label">Outcome 2 Label</Label>
                <Input
                  id="outcome1Label"
                  name="outcome1Label"
                  value={formData.outcome1Label}
                  onChange={handleChange}
                  placeholder="Team B / No"
                  required
                />
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Details */}
        <GlassCard variant="solid">
          <GlassCardHeader>
            <h2 className="text-lg font-semibold">Market Details (Rules)</h2>
            <p className="text-sm text-muted-foreground">
              Write the market rules and resolution criteria
            </p>
          </GlassCardHeader>
          <GlassCardContent>
            <TipTapEditor
              content={formData.detailsMarkdown}
              onChange={(content) =>
                setFormData((prev) => ({ ...prev, detailsMarkdown: content }))
              }
            />
          </GlassCardContent>
        </GlassCard>

        {/* Timing */}
        <GlassCard variant="solid">
          <GlassCardHeader>
            <h2 className="text-lg font-semibold">Schedule</h2>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="opensAt">Opens At</Label>
                <Input
                  id="opensAt"
                  name="opensAt"
                  type="datetime-local"
                  value={formData.opensAt}
                  onChange={handleChange}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="closesAt">Closes At</Label>
                <Input
                  id="closesAt"
                  name="closesAt"
                  type="datetime-local"
                  value={formData.closesAt}
                  onChange={handleChange}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="resolutionSourceUrl">Resolution Source URL</Label>
              <Input
                id="resolutionSourceUrl"
                name="resolutionSourceUrl"
                value={formData.resolutionSourceUrl}
                onChange={handleChange}
                placeholder="https://..."
                type="url"
              />
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Economics */}
        <GlassCard variant="solid">
          <GlassCardHeader>
            <h2 className="text-lg font-semibold">Economics</h2>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feeBps">Fee (basis points)</Label>
                <Input
                  id="feeBps"
                  name="feeBps"
                  type="number"
                  value={formData.feeBps}
                  onChange={handleChange}
                  placeholder="100"
                />
                <p className="text-xs text-muted-foreground">100 = 1% fee</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seed0">Seed Liquidity 1</Label>
                <Input
                  id="seed0"
                  name="seed0"
                  type="number"
                  value={formData.seed0}
                  onChange={handleChange}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seed1">Seed Liquidity 2</Label>
                <Input
                  id="seed1"
                  name="seed1"
                  type="number"
                  value={formData.seed1}
                  onChange={handleChange}
                  placeholder="1000"
                />
              </div>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Create Market
          </Button>
        </div>

        {createMutation.isError && (
          <p className="text-destructive text-sm text-center">
            {createMutation.error instanceof Error
              ? createMutation.error.message
              : "An error occurred"}
          </p>
        )}
      </form>
    </div>
  );
}
