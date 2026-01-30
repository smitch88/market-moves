"use client";

import { useState } from "react";
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
} from "@vault/ui";
import { Loader2, X } from "lucide-react";
import { ImageUpload } from "@/components/admin";
import type { Tag, MarketCategory } from "@vault/database";

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

export default function AdminNewEventPage() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    category: "OTHER" as MarketCategory,
    bannerUrl: "",
    logoUrl: "",
    startTime: "",
    endTime: "",
    // First market
    question: "",
    outcome0Label: "Yes",
    outcome1Label: "No",
    opensAt: "",
    closesAt: "",
    feeBps: "100",
    seed0: "1000",
    seed1: "1000",
  });

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

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
          startTime: data.startTime
            ? new Date(data.startTime).toISOString()
            : undefined,
          endTime: data.endTime
            ? new Date(data.endTime).toISOString()
            : undefined,
          tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
          markets: [
            {
              question: data.question || data.title,
              outcomes: [data.outcome0Label, data.outcome1Label],
              opensAt: data.opensAt
                ? new Date(data.opensAt).toISOString()
                : undefined,
              closesAt: data.closesAt
                ? new Date(data.closesAt).toISOString()
                : undefined,
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">New Event</h1>
        <p className="text-muted-foreground">
          Create a new event with its first market
        </p>
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
                <Label htmlFor="startTime">Event Start Time</Label>
                <Input
                  id="startTime"
                  name="startTime"
                  type="datetime-local"
                  value={formData.startTime}
                  onChange={handleChange}
                />
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
