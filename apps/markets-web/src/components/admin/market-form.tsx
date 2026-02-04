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
} from "@vault/ui";
import { Loader2 } from "lucide-react";
import type { Market, Event, MarketCategory } from "@vault/database";
import { TipTapEditor } from "./tiptap-editor";
import { ImageUpload } from "./image-upload";

// Helper to parse outcomes
function parseOutcomes(outcomes: string): string[] {
  try {
    return JSON.parse(outcomes);
  } catch {
    return ["Yes", "No"];
  }
}

interface MarketFormProps {
  market?: Market & { event: Event };
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

  // Parse outcomes if editing
  const existingOutcomes = market ? parseOutcomes(market.outcomes) : ["", ""];

  const [formData, setFormData] = useState({
    // Event fields
    title: market?.event?.title || "",
    slug: market?.event?.slug || "",
    description: market?.event?.description || "",
    category: market?.event?.category || "OTHER",
    bannerUrl: market?.event?.bannerUrl || "",
    logoUrl: market?.event?.logoUrl || "",
    startTime: market?.event?.startTime ? formatDateForInput(market.event.startTime) : "",
    // Market fields
    question: market?.question || "",
    detailsMarkdown: market?.detailsMarkdown || "",
    resolutionSourceUrl: market?.resolutionSourceUrl || "",
    opensAt: market?.opensAt ? formatDateForInput(market.opensAt) : "",
    closesAt: market?.closesAt ? formatDateForInput(market.closesAt) : "",
    feeBps: market?.feeBps?.toString() || "100",
    seed0: market?.seed0?.toString() || "100000",
    seed1: market?.seed1?.toString() || "100000",
    outcome0Label: existingOutcomes[0] || "",
    outcome1Label: existingOutcomes[1] || "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Create event with market
      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          slug: data.slug,
          description: data.description || undefined,
          category: data.category,
          bannerUrl: data.bannerUrl || undefined,
          logoUrl: data.logoUrl || undefined,
          startTime: data.startTime ? inputToUTCISO(data.startTime) : undefined,
          markets: [
            {
              question: data.question || data.title,
              outcomes: [data.outcome0Label, data.outcome1Label],
              detailsMarkdown: data.detailsMarkdown || undefined,
              resolutionSourceUrl: data.resolutionSourceUrl || undefined,
              opensAt: data.opensAt ? inputToUTCISO(data.opensAt) : undefined,
              closesAt: data.closesAt ? inputToUTCISO(data.closesAt) : undefined,
              feeBps: parseInt(data.feeBps, 10),
              seed0: parseInt(data.seed0, 10),
              seed1: parseInt(data.seed1, 10),
            },
          ],
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create event");
      }

      return res.json();
    },
    onSuccess: (data) => {
      const marketId = data.event?.markets?.[0]?.id;
      if (marketId) {
        router.push(`/admin/markets/${marketId}`);
      } else {
        router.push("/admin/markets");
      }
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Update market
      const res = await fetch(`/api/admin/markets/${market!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: data.question,
          outcomes: [data.outcome0Label, data.outcome1Label],
          detailsMarkdown: data.detailsMarkdown || undefined,
          resolutionSourceUrl: data.resolutionSourceUrl || undefined,
          opensAt: data.opensAt ? inputToUTCISO(data.opensAt) : undefined,
          closesAt: data.closesAt ? inputToUTCISO(data.closesAt) : undefined,
          feeBps: parseInt(data.feeBps, 10),
          seed0: parseInt(data.seed0, 10),
          seed1: parseInt(data.seed1, 10),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update market");
      }

      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/admin/markets/${data.market.id}`);
    },
  });

  const mutation = isEditing ? updateMutation : createMutation;

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
      {/* Event info (only for new) */}
      {!isEditing && (
        <GlassCard>
          <GlassCardHeader>
            <h2 className="text-lg font-semibold">Event Information</h2>
            <p className="text-sm text-muted-foreground">
              Events group related markets together
            </p>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Event Title</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Super Bowl LIX"
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
                  placeholder="super-bowl-lix"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Brief description of the event..."
                rows={2}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <div className="space-y-2">
                <Label htmlFor="startTime">
                  Event Start Time <span className="text-xs text-muted-foreground font-normal">(UTC)</span>
                </Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={handleChange}
                />
                {formData.startTime && (
                  <p className="text-xs text-muted-foreground">
                    <span className="text-foreground/70">Your local time:</span>{" "}
                    {formatLocalTime(formData.startTime)}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <ImageUpload
                label="Banner Image"
                value={formData.bannerUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, bannerUrl: url }))}
                folder="events/banners"
                aspectRatio="banner"
                placeholder="https://..."
              />
              <ImageUpload
                label="Logo Image"
                value={formData.logoUrl}
                onChange={(url) => setFormData((prev) => ({ ...prev, logoUrl: url }))}
                folder="events/logos"
                aspectRatio="square"
                placeholder="https://..."
              />
            </div>
          </GlassCardContent>
        </GlassCard>
      )}

      {/* Market info */}
      <GlassCard>
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
          <p className="text-sm text-muted-foreground">
            All times are saved in <span className="font-medium text-foreground">UTC</span>. Your local time is shown below for reference.
          </p>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="opensAt">
                Opens At <span className="text-xs text-muted-foreground font-normal">(UTC)</span>
              </Label>
              <Input
                id="opensAt"
                name="opensAt"
                type="datetime-local"
                value={formData.opensAt}
                onChange={handleChange}
              />
              {formData.opensAt && (
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground/70">Your local time:</span>{" "}
                  {formatLocalTime(formData.opensAt)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="closesAt">
                Closes At (Kickoff) <span className="text-xs text-muted-foreground font-normal">(UTC)</span>
              </Label>
              <Input
                id="closesAt"
                name="closesAt"
                type="datetime-local"
                value={formData.closesAt}
                onChange={handleChange}
              />
              {formData.closesAt && (
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground/70">Your local time:</span>{" "}
                  {formatLocalTime(formData.closesAt)}
                </p>
              )}
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
          <div className="space-y-2">
            <Label htmlFor="feeBps">Fee (basis points)</Label>
            <Input
              id="feeBps"
              name="feeBps"
              type="number"
              value={formData.feeBps}
              onChange={handleChange}
              placeholder="100"
              className="max-w-xs"
            />
            <p className="text-xs text-muted-foreground">
              100 = 1% fee on winning payouts
            </p>
          </div>
          
          <div className="pt-4 border-t border-border/50">
            <h3 className="text-sm font-medium mb-1">Initial Liquidity</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Sets the AMM depth for price stability. Higher values = less price impact per trade. 
              Equal values start at 50/50 odds. Minimum 100 required.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="seed0">
                  {formData.outcome0Label || "Outcome 1"} Liquidity
                </Label>
                <Input
                  id="seed0"
                  name="seed0"
                  type="number"
                  min="100"
                  value={formData.seed0}
                  onChange={handleChange}
                  placeholder="100000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="seed1">
                  {formData.outcome1Label || "Outcome 2"} Liquidity
                </Label>
                <Input
                  id="seed1"
                  name="seed1"
                  type="number"
                  min="100"
                  value={formData.seed1}
                  onChange={handleChange}
                  placeholder="100000"
                />
              </div>
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
          {isEditing ? "Save Changes" : "Create Event & Market"}
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

// Format a UTC date for datetime-local input (displays UTC time)
function formatDateForInput(date: Date | string): string {
  let d: Date;
  if (typeof date === "string") {
    // Ensure the string is parsed as UTC by appending Z if not present
    const dateStr = date.endsWith("Z") || date.includes("+") || date.includes("-", 10) 
      ? date 
      : date + "Z";
    d = new Date(dateStr);
  } else {
    d = date;
  }
  // Get UTC components and format as YYYY-MM-DDTHH:MM
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hours = String(d.getUTCHours()).padStart(2, "0");
  const minutes = String(d.getUTCMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Convert datetime-local input value (which represents UTC) to ISO string for saving
function inputToUTCISO(inputValue: string): string {
  if (!inputValue) return "";
  // Append Z to treat the input value as UTC
  return new Date(inputValue + "Z").toISOString();
}

// Format UTC date string to user's local timezone for display
function formatLocalTime(utcDateString: string): string {
  if (!utcDateString) return "";
  try {
    // The input value represents UTC time, so append Z to parse as UTC
    const utcDate = new Date(utcDateString + "Z");
    
    // Format in user's local timezone
    return utcDate.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return "";
  }
}
