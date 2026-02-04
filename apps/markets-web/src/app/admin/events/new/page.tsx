"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
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
  Badge,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Switch,
} from "@vault/ui";
import { Loader2, X, Users, Copy } from "lucide-react";
import { ImageUpload, CloneSelector, type EventForClone } from "@/components/admin";
import { inputToUtcIso, formatUtcAsLocal, formatUtcForInput } from "@/components/admin/datetime-utils";
import type { Tag, MarketCategory } from "@vault/database";

// KOL type for selector
interface KOL {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
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

// Helper to generate a unique slug from a title
function generateUniqueSlug(title: string): string {
  const baseSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  // Add timestamp to ensure uniqueness
  const timestamp = Date.now().toString(36);
  return `${baseSlug}-${timestamp}`;
}

// Helper to parse outcomes from JSON
function parseOutcomes(outcomesJson: string): string[] {
  try {
    return JSON.parse(outcomesJson);
  } catch {
    return ["Yes", "No"];
  }
}

export default function AdminNewEventPage() {
  const router = useRouter();
  const [showCloneSelector, setShowCloneSelector] = useState(true);
  const [clonedFrom, setClonedFrom] = useState<EventForClone | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    category: "OTHER" as MarketCategory,
    bannerUrl: "",
    logoUrl: "",
    startTime: "",
    endTime: "",
    featured: false,
    pinned: false,
    createdByKolId: "",
    // First market
    question: "",
    outcome0Label: "Yes",
    outcome1Label: "No",
    opensAt: "",
    closesAt: "",
    feeBps: "100",
    seed0: "100000",
    seed1: "100000",
  });

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Handle clone selection
  const handleCloneSelect = useCallback((data: EventForClone | null) => {
    setShowCloneSelector(false);
    
    if (data) {
      // Clone from selected event
      setClonedFrom(data);
      const firstMarket = data.markets[0];
      const outcomes = firstMarket ? parseOutcomes(firstMarket.outcomes) : ["Yes", "No"];
      
      setFormData({
        title: `${data.title} (Copy)`,
        slug: generateUniqueSlug(data.title),
        description: data.description || "",
        category: data.category,
        bannerUrl: data.bannerUrl || "",
        logoUrl: data.logoUrl || "",
        startTime: "", // Don't copy dates - they should be new
        endTime: "",
        featured: false, // Don't copy - should be explicitly set
        pinned: false, // Don't copy - should be explicitly set
        createdByKolId: data.createdByKolId || "",
        // First market from cloned event
        question: firstMarket?.question || "",
        outcome0Label: outcomes[0] || "Yes",
        outcome1Label: outcomes[1] || "No",
        opensAt: "",
        closesAt: "",
        feeBps: firstMarket?.feeBps?.toString() || "100",
        seed0: firstMarket?.seed0?.toString() || "100000",
        seed1: firstMarket?.seed1?.toString() || "100000",
      });
      
      // Copy tags
      setSelectedTagIds(data.tags.map((t) => t.id));
    }
  }, []);

  // Fetch available tags
  const { data: tagsData } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
  });

  const availableTags: Tag[] = tagsData || [];

  // Fetch available KOLs/Captains
  const { data: kolsData } = useQuery({
    queryKey: ["kols"],
    queryFn: async () => {
      const res = await fetch("/api/kols");
      if (!res.ok) throw new Error("Failed to fetch KOLs");
      return res.json();
    },
  });

  const availableKols: KOL[] = kolsData?.kols || [];

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
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
          startTime: inputToUtcIso(data.startTime),
          endTime: inputToUtcIso(data.endTime),
          featured: data.featured,
          pinned: data.pinned,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
          createdByKolId: data.createdByKolId || undefined,
          markets: [
            {
              question: data.question || data.title,
              outcomes: [data.outcome0Label, data.outcome1Label],
              opensAt: inputToUtcIso(data.opensAt),
              closesAt: inputToUtcIso(data.closesAt),
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
      router.push(`/admin/events/${data.event.id}`);
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

    // Auto-generate slug from title
    if (name === "title") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  // Show clone selector first
  if (showCloneSelector) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">New Event</h1>
          <p className="text-muted-foreground">
            Create a new event with its first market
          </p>
        </div>

        <CloneSelector
          type="event"
          onSelect={(data) => handleCloneSelect(data as EventForClone | null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">New Event</h1>
          <p className="text-muted-foreground">
            Create a new event with its first market
          </p>
        </div>
        {clonedFrom && (
          <Badge variant="secondary" className="flex items-center gap-1.5">
            <Copy className="h-3 w-3" />
            Cloned from: {clonedFrom.title}
          </Badge>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Event info */}
        <GlassCard variant="solid">
          <GlassCardHeader>
            <h2 className="text-lg font-semibold">Event Information</h2>
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
                    setFormData((prev) => ({
                      ...prev,
                      category: value as MarketCategory,
                    }))
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
                <Label htmlFor="startTime">Event Start Time (UTC)</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={handleChange}
                />
                {formData.startTime && (
                  <p className="text-xs text-muted-foreground">
                    Local: {formatUtcAsLocal(inputToUtcIso(formData.startTime))}
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

        {/* Tags */}
        {availableTags.length > 0 && (
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h2 className="text-lg font-semibold">Tags</h2>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <Badge
                      key={tag.id}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer transition-colors"
                      onClick={() => toggleTag(tag.id)}
                    >
                      {tag.label}
                      {isSelected && <X className="h-3 w-3 ml-1" />}
                    </Badge>
                  );
                })}
              </div>
            </GlassCardContent>
          </GlassCard>
        )}

        {/* Captain Attribution */}
        <GlassCard variant="solid">
          <GlassCardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Captain Attribution</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Attribute this event to a Captain (optional). Their avatar will appear as a badge on the event card.
            </p>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Captain</Label>
              <Select
                value={formData.createdByKolId}
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    createdByKolId: value === "none" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="No captain selected" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">No captain</span>
                  </SelectItem>
                  {availableKols.map((kol) => (
                    <SelectItem key={kol.id} value={kol.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={kol.profileImageUrl || undefined} />
                          <AvatarFallback className="text-xs">
                            {(kol.name || kol.handle || "K")[0].toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span>{kol.name || kol.handle || "Unknown"}</span>
                        {kol.handle && (
                          <span className="text-muted-foreground text-xs">
                            @{kol.handle}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview - only shown when captain is selected */}
            {formData.createdByKolId && (() => {
              const selectedKol = availableKols.find(k => k.id === formData.createdByKolId);
              if (!selectedKol) return null;
              return (
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm text-muted-foreground mb-2">Preview (shown under event description):</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Made by</span>
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={selectedKol.profileImageUrl || undefined} />
                      <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                        {(selectedKol.name || selectedKol.handle || "K")[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground font-medium">
                      @{selectedKol.handle}
                    </span>
                  </div>
                </div>
              );
            })()}

            {availableKols.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No Captains available. Designate users as Captains in the Users section.
              </p>
            )}
          </GlassCardContent>
        </GlassCard>

        {/* Visibility & Promotion */}
        <GlassCard variant="solid">
          <GlassCardHeader>
            <h2 className="text-lg font-semibold">Visibility & Promotion</h2>
            <p className="text-sm text-muted-foreground">
              Control how this event appears on the home page
            </p>
          </GlassCardHeader>
          <GlassCardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Featured</Label>
                <p className="text-sm text-muted-foreground">
                  Show in the <span className="font-medium text-foreground">top banner carousel</span> on the home page. Only one event should be featured at a time.
                </p>
              </div>
              <Switch
                checked={formData.featured}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, featured: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Pinned</Label>
                <p className="text-sm text-muted-foreground">
                  Show in the <span className="font-medium text-foreground">&quot;Featured&quot; section</span> grid below the banner. Up to 6 pinned events are displayed.
                </p>
              </div>
              <Switch
                checked={formData.pinned}
                onCheckedChange={(checked) =>
                  setFormData((prev) => ({ ...prev, pinned: checked }))
                }
              />
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* First market */}
        <GlassCard variant="solid">
          <GlassCardHeader>
            <h2 className="text-lg font-semibold">First Market</h2>
            <p className="text-sm text-muted-foreground">
              Create the first market for this event
            </p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outcome0Label">Outcome 1</Label>
                <Input
                  id="outcome0Label"
                  name="outcome0Label"
                  value={formData.outcome0Label}
                  onChange={handleChange}
                  placeholder="Yes"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outcome1Label">Outcome 2</Label>
                <Input
                  id="outcome1Label"
                  name="outcome1Label"
                  value={formData.outcome1Label}
                  onChange={handleChange}
                  placeholder="No"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="opensAt">Opens At (UTC)</Label>
                <Input
                  id="opensAt"
                  name="opensAt"
                  type="datetime-local"
                  value={formData.opensAt}
                  onChange={handleChange}
                />
                {formData.opensAt && (
                  <p className="text-xs text-muted-foreground">
                    Local: {formatUtcAsLocal(inputToUtcIso(formData.opensAt))}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="closesAt">Closes At (UTC)</Label>
                <Input
                  id="closesAt"
                  name="closesAt"
                  type="datetime-local"
                  value={formData.closesAt}
                  onChange={handleChange}
                />
                {formData.closesAt && (
                  <p className="text-xs text-muted-foreground">
                    Local: {formatUtcAsLocal(inputToUtcIso(formData.closesAt))}
                  </p>
                )}
              </div>
            </div>

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
            Create Event & Market
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
