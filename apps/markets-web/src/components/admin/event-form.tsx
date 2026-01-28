"use client";

import { useState, useEffect } from "react";
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
  Switch,
} from "@vault/ui";
import { Loader2, X } from "lucide-react";
import type { Event, Tag, MarketCategory } from "@vault/database";

interface EventFormProps {
  event?: Event & { tags: Tag[] };
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

function formatDateForInput(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 16);
}

export function EventForm({ event }: EventFormProps) {
  const router = useRouter();
  const isEditing = !!event;

  const [formData, setFormData] = useState({
    title: event?.title || "",
    slug: event?.slug || "",
    description: event?.description || "",
    category: event?.category || "OTHER",
    bannerUrl: event?.bannerUrl || "",
    logoUrl: event?.logoUrl || "",
    startTime: event?.startTime ? formatDateForInput(event.startTime) : "",
    endTime: event?.endTime ? formatDateForInput(event.endTime) : "",
    active: event?.active ?? true,
    closed: event?.closed ?? false,
  });

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    event?.tags?.map((t) => t.id) || []
  );

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

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await fetch(`/api/admin/events/${event!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: data.title,
          description: data.description || undefined,
          category: data.category,
          bannerUrl: data.bannerUrl || undefined,
          logoUrl: data.logoUrl || undefined,
          startTime: data.startTime
            ? new Date(data.startTime).toISOString()
            : null,
          endTime: data.endTime ? new Date(data.endTime).toISOString() : null,
          active: data.active,
          closed: data.closed,
          tagIds: selectedTagIds,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update event");
      }

      return res.json();
    },
    onSuccess: (data) => {
      router.push(`/admin/events/${data.event.id}`);
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic info */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Event Information</h2>
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
                placeholder="Super Bowl LIX"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (read-only)</Label>
              <Input
                id="slug"
                name="slug"
                value={formData.slug}
                disabled
                className="bg-muted"
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
              rows={3}
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
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Timing */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Timing</h2>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time</Label>
              <Input
                id="startTime"
                name="startTime"
                type="datetime-local"
                value={formData.startTime}
                onChange={handleChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                name="endTime"
                type="datetime-local"
                value={formData.endTime}
                onChange={handleChange}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              {formData.bannerUrl && (
                <img
                  src={formData.bannerUrl}
                  alt="Banner preview"
                  className="w-full h-20 object-cover rounded-md mt-2"
                />
              )}
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
              {formData.logoUrl && (
                <img
                  src={formData.logoUrl}
                  alt="Logo preview"
                  className="w-12 h-12 object-cover rounded-md mt-2"
                />
              )}
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Tags */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Tags</h2>
          <p className="text-sm text-muted-foreground">
            Select tags to categorize this event
          </p>
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
            {availableTags.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No tags available. Create tags in the Tags section.
              </p>
            )}
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Status */}
      <GlassCard>
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">Status</h2>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Active</Label>
              <p className="text-sm text-muted-foreground">
                Event is visible and markets can accept bets
              </p>
            </div>
            <Switch
              checked={formData.active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, active: checked }))
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Closed</Label>
              <p className="text-sm text-muted-foreground">
                Event has ended and no new bets are accepted
              </p>
            </div>
            <Switch
              checked={formData.closed}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, closed: checked }))
              }
            />
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Submit */}
      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending && (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          Save Changes
        </Button>
      </div>

      {updateMutation.isError && (
        <p className="text-destructive text-sm text-center">
          {updateMutation.error instanceof Error
            ? updateMutation.error.message
            : "An error occurred"}
        </p>
      )}
    </form>
  );
}
