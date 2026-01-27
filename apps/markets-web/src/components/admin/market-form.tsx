"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  Button,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Separator,
} from "@vault/ui";
import { Loader2 } from "lucide-react";
import type { Market, Outcome, MarketCategory } from "@vault/database";
import { TipTapEditor } from "./tiptap-editor";

interface MarketFormProps {
  market?: Market & { outcomes: Outcome[] };
}

const categories: { value: MarketCategory; label: string }[] = [
  { value: "NFL", label: "NFL" },
  { value: "NBA", label: "NBA" },
  { value: "NHL", label: "NHL" },
  { value: "MLB", label: "MLB" },
  { value: "SOCCER", label: "Soccer" },
  { value: "UFC", label: "UFC" },
  { value: "TENNIS", label: "Tennis" },
  { value: "GOLF", label: "Golf" },
  { value: "ESPORTS", label: "Esports" },
  { value: "POLITICS", label: "Politics" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "FINANCE", label: "Finance" },
  { value: "ENTERTAINMENT", label: "Entertainment" },
  { value: "OTHER", label: "Other" },
];

export function MarketForm({ market }: MarketFormProps) {
  const router = useRouter();
  const isEditing = !!market;

  const outcomeA = market?.outcomes.find((o) => o.key === "A");
  const outcomeB = market?.outcomes.find((o) => o.key === "B");

  const [formData, setFormData] = useState({
    title: market?.title || "",
    question: market?.question || "",
    slug: market?.slug || "",
    category: market?.category || "OTHER",
    bannerUrl: market?.bannerUrl || "",
    logoUrl: market?.logoUrl || "",
    detailsMarkdown: market?.detailsMarkdown || "",
    resolutionSourceUrl: market?.resolutionSourceUrl || "",
    opensAt: market?.opensAt ? formatDateForInput(market.opensAt) : "",
    closesAt: market?.closesAt ? formatDateForInput(market.closesAt) : "",
    feeBps: market?.feeBps?.toString() || "400",
    seedA: market?.seedA?.toString() || "0",
    seedB: market?.seedB?.toString() || "0",
    outcomeALabel: outcomeA?.label || "",
    outcomeBLabel: outcomeB?.label || "",
  });

  const mutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const url = isEditing
        ? `/api/admin/markets/${market.id}`
        : "/api/admin/markets";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          feeBps: parseInt(data.feeBps, 10),
          seedA: parseInt(data.seedA, 10),
          seedB: parseInt(data.seedB, 10),
          opensAt: data.opensAt ? new Date(data.opensAt).toISOString() : null,
          closesAt: data.closesAt ? new Date(data.closesAt).toISOString() : null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save market");
      }

      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/admin/markets/${data.market.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-generate slug from title
    if (name === "title" && !isEditing) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic info */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Basic Information</h2>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Super Bowl 2026"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                name="slug"
                value={formData.slug}
                onChange={handleChange}
                placeholder="super-bowl-2026"
                required
                disabled={isEditing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="question">Question</Label>
            <Input
              id="question"
              name="question"
              value={formData.question}
              onChange={handleChange}
              placeholder="Who will win the Super Bowl?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, category: value as MarketCategory }))
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Outcomes */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Outcomes</h2>
          <p className="text-sm text-muted-foreground">
            Define the two possible outcomes for this market
          </p>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="outcomeALabel">Outcome A Label</Label>
              <Input
                id="outcomeALabel"
                name="outcomeALabel"
                value={formData.outcomeALabel}
                onChange={handleChange}
                placeholder="Team A / Yes"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="outcomeBLabel">Outcome B Label</Label>
              <Input
                id="outcomeBLabel"
                name="outcomeBLabel"
                value={formData.outcomeBLabel}
                onChange={handleChange}
                placeholder="Team B / No"
                required
              />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Media */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Media</h2>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bannerUrl">Banner URL</Label>
            <Input
              id="bannerUrl"
              name="bannerUrl"
              value={formData.bannerUrl}
              onChange={handleChange}
              placeholder="https://..."
              type="url"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              name="logoUrl"
              value={formData.logoUrl}
              onChange={handleChange}
              placeholder="https://..."
              type="url"
            />
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Details */}
      <GlassCard>
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
      <GlassCard>
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
              <Label htmlFor="closesAt">Closes At (Kickoff)</Label>
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
      <GlassCard>
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
                placeholder="400"
              />
              <p className="text-xs text-muted-foreground">
                400 = 4% fee
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="seedA">Seed Liquidity A</Label>
              <Input
                id="seedA"
                name="seedA"
                type="number"
                value={formData.seedA}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seedB">Seed Liquidity B</Label>
              <Input
                id="seedB"
                name="seedB"
                type="number"
                value={formData.seedB}
                onChange={handleChange}
                placeholder="0"
              />
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEditing ? "Save Changes" : "Create Market"}
        </Button>
      </div>

      {mutation.isError && (
        <p className="text-destructive text-sm text-center">
          {mutation.error instanceof Error
            ? mutation.error.message
            : "An error occurred"}
        </p>
      )}
    </form>
  );
}

function formatDateForInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 16);
}
