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
  Switch,
  Avatar,
  AvatarImage,
  AvatarFallback,
} from "@vault/ui";
import { Loader2, X, Users } from "lucide-react";
import type { Event, Tag, MarketCategory } from "@vault/database";
import { ImageUpload } from "./image-upload";

// KOL type for selector
interface KOL {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
}

// KOL Creator info on event
interface KOLCreator {
  id: string;
  name: string | null;
  handle: string | null;
  profileImageUrl: string | null;
}

interface EventFormProps {
  event?: Event & { tags: Tag[]; createdByKol?: KOLCreator | null };
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
    createdByKolId: event?.createdByKolId || "",
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
          startTime: data.startTime ? inputToUTCISO(data.startTime) : null,
          endTime: data.endTime ? inputToUTCISO(data.endTime) : null,
          active: data.active,
          closed: data.closed,
          tagIds: selectedTagIds,
          createdByKolId: data.createdByKolId || null,
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
          <p className="text-sm text-muted-foreground">
            All times are saved in <span className="font-medium text-foreground">UTC</span>. Your local time is shown below for reference.
          </p>
        </GlassCardHeader>
        <GlassCardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">
                Start Time <span className="text-xs text-muted-foreground font-normal">(UTC)</span>
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
            <div className="space-y-2">
              <Label htmlFor="endTime">
                End Time <span className="text-xs text-muted-foreground font-normal">(UTC)</span>
              </Label>
              <Input
                id="endTime"
                name="endTime"
                type="datetime-local"
                value={formData.endTime}
                onChange={handleChange}
              />
              {formData.endTime && (
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground/70">Your local time:</span>{" "}
                  {formatLocalTime(formData.endTime)}
                </p>
              )}
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

      {/* Captain Attribution */}
      <GlassCard>
        <GlassCardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Captain Attribution</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Attribute this event to a Captain. Their avatar will appear as a badge on the event card.
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
