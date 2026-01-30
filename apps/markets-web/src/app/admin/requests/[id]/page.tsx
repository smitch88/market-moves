"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import {
  Badge,
  Button,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Input,
  Label,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Switch,
  toast,
} from "@vault/ui";
import {
  Loader2,
  ArrowLeft,
  Lightbulb,
  CheckCircle,
  XCircle,
  Clock,
  Sparkles,
  ExternalLink,
  User,
  Plus,
  Trash2,
  Calendar,
  X,
  Wand2,
  RotateCcw,
  Brain,
  Tag as TagIcon,
} from "lucide-react";
import type { Tag, MarketCategory, EventType } from "@vault/database";
import { ImageUpload } from "@/components/admin";

interface MarketRequest {
  id: string;
  title: string;
  description: string;
  sourceUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CREATED";
  adminNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    profileImageUrl: string | null;
  };
  reviewer?: {
    id: string;
    name: string | null;
    handle: string | null;
  } | null;
}

interface MarketForm {
  id: string;
  question: string;
  outcome0Label: string;
  outcome1Label: string;
  detailsMarkdown: string;
  resolutionSourceUrl: string;
  opensAt: string;
  closesAt: string;
  feeBps: string;
  seed0: string;
  seed1: string;
}

const statusConfig = {
  PENDING: {
    label: "Pending",
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    icon: Clock,
  },
  APPROVED: {
    label: "Approved",
    color: "bg-green-500/10 text-green-500 border-green-500/20",
    icon: CheckCircle,
  },
  REJECTED: {
    label: "Rejected",
    color: "bg-red-500/10 text-red-500 border-red-500/20",
    icon: XCircle,
  },
  CREATED: {
    label: "Market Created",
    color: "bg-primary/10 text-primary border-primary/20",
    icon: Sparkles,
  },
};

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

const eventTypes: { value: EventType; label: string }[] = [
  { value: "MATCHUP", label: "Matchup (Head-to-head)" },
  { value: "PROP", label: "Prop (Multiple outcomes)" },
  { value: "TOURNAMENT", label: "Tournament" },
  { value: "FUTURES", label: "Futures" },
];

function createEmptyMarket(): MarketForm {
  return {
    id: crypto.randomUUID(),
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
  };
}

export default function AdminRequestReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Request status state
  const [requestStatus, setRequestStatus] = useState<MarketRequest["status"]>("PENDING");
  const [adminNotes, setAdminNotes] = useState("");

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: "",
    slug: "",
    description: "",
    category: "OTHER" as MarketCategory,
    eventType: "PROP" as EventType,
    bannerUrl: "",
    logoUrl: "",
    startTime: "",
    endTime: "",
  });

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [newTags, setNewTags] = useState<{ label: string; slug: string }[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [markets, setMarkets] = useState<MarketForm[]>([createEmptyMarket()]);
  const [includeMarkets, setIncludeMarkets] = useState(true);

  // Fetch the request
  const { data: request, isLoading: requestLoading } = useQuery<MarketRequest>({
    queryKey: ["adminRequest", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/requests/${id}`);
      if (!res.ok) throw new Error("Failed to fetch request");
      return res.json();
    },
  });

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

  // Initialize form with request data
  useEffect(() => {
    if (request) {
      setRequestStatus(request.status);
      setAdminNotes(request.adminNotes || "");
      
      // Pre-populate event form with request data
      const slug = request.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      
      setEventForm((prev) => ({
        ...prev,
        title: request.title,
        slug,
        description: request.description,
      }));

      // Pre-populate first market with request title as question
      setMarkets([
        {
          ...createEmptyMarket(),
          question: request.title,
          resolutionSourceUrl: request.sourceUrl || "",
        },
      ]);
    }
  }, [request]);

  // Update request status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      status,
      adminNotes,
    }: {
      status: MarketRequest["status"];
      adminNotes?: string;
    }) => {
      const res = await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNotes }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update request");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Request status updated");
      queryClient.invalidateQueries({ queryKey: ["adminRequest", id] });
      queryClient.invalidateQueries({ queryKey: ["adminRequests"] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update status");
    },
  });

  // Create event mutation
  const createEventMutation = useMutation({
    mutationFn: async () => {
      // Build the request payload
      const payload: Record<string, unknown> = {
        title: eventForm.title,
        slug: eventForm.slug,
        description: eventForm.description || undefined,
        category: eventForm.category,
        eventType: eventForm.eventType,
        bannerUrl: eventForm.bannerUrl || undefined,
        logoUrl: eventForm.logoUrl || undefined,
        startTime: eventForm.startTime
          ? new Date(eventForm.startTime).toISOString()
          : undefined,
        endTime: eventForm.endTime
          ? new Date(eventForm.endTime).toISOString()
          : undefined,
        tagIds: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        newTags: newTags.length > 0 ? newTags : undefined,
      };

      // Only include markets if enabled and at least one market has a question
      if (includeMarkets) {
        const validMarkets = markets.filter((m) => m.question.trim());
        if (validMarkets.length > 0) {
          payload.markets = validMarkets.map((m) => ({
            question: m.question || eventForm.title,
            outcomes: [m.outcome0Label, m.outcome1Label],
            detailsMarkdown: m.detailsMarkdown || undefined,
            resolutionSourceUrl: m.resolutionSourceUrl || undefined,
            opensAt: m.opensAt ? new Date(m.opensAt).toISOString() : undefined,
            closesAt: m.closesAt ? new Date(m.closesAt).toISOString() : undefined,
            feeBps: parseInt(m.feeBps, 10),
            seed0: parseInt(m.seed0, 10),
            seed1: parseInt(m.seed1, 10),
          }));
        }
      }

      const res = await fetch("/api/admin/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create event");
      }

      const eventData = await res.json();

      // Then update the request status to CREATED
      await fetch(`/api/admin/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CREATED", adminNotes }),
      });

      return eventData;
    },
    onSuccess: (data) => {
      const marketCount = data.event.markets?.length || 0;
      const message = marketCount > 0 
        ? `Event created with ${marketCount} market${marketCount > 1 ? 's' : ''}!`
        : "Event created! You can add markets from the event page.";
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["adminRequest", id] });
      queryClient.invalidateQueries({ queryKey: ["adminRequests"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      // Redirect to the new event page
      router.push(`/admin/events/${data.event.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create event");
    },
  });

  // AI Generation mutation
  const aiGenerateMutation = useMutation({
    mutationFn: async () => {
      if (!request) throw new Error("No request data");
      
      const res = await fetch("/api/admin/ai/generate-market", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: request.title,
          description: request.description,
          sourceUrl: request.sourceUrl,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || error.message || "Failed to generate with AI");
      }

      return res.json();
    },
    onSuccess: (data) => {
      if (!data.generated) {
        toast.error("AI did not return valid data");
        return;
      }

      const { event, markets: generatedMarkets, reasoning } = data.generated;

      // Helper to format ISO date to datetime-local format
      const formatDateForInput = (isoDate: string | null) => {
        if (!isoDate) return "";
        try {
          const date = new Date(isoDate);
          return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:mm
        } catch {
          return "";
        }
      };

      // Update event form
      setEventForm({
        title: event.title || request?.title || "",
        slug: event.slug || "",
        description: event.description || "",
        category: (event.category || "OTHER") as MarketCategory,
        eventType: (event.eventType || "PROP") as EventType,
        bannerUrl: event.bannerUrl || "",
        logoUrl: event.logoUrl || "",
        startTime: formatDateForInput(event.startTime),
        endTime: formatDateForInput(event.endTime),
      });

      // Update markets
      if (generatedMarkets && generatedMarkets.length > 0) {
        setMarkets(
          generatedMarkets.map((m: {
            question: string;
            outcome0Label: string;
            outcome1Label: string;
            detailsMarkdown?: string;
            resolutionSourceUrl?: string;
            opensAt?: string;
            closesAt?: string;
            feeBps?: number;
            seed0?: number;
            seed1?: number;
          }) => ({
            id: crypto.randomUUID(),
            question: m.question || "",
            outcome0Label: m.outcome0Label || "Yes",
            outcome1Label: m.outcome1Label || "No",
            detailsMarkdown: m.detailsMarkdown || "",
            resolutionSourceUrl: m.resolutionSourceUrl || "",
            opensAt: formatDateForInput(m.opensAt || null),
            closesAt: formatDateForInput(m.closesAt || null),
            feeBps: String(m.feeBps || 100),
            seed0: String(m.seed0 || 1000),
            seed1: String(m.seed1 || 1000),
          }))
        );
      }

      toast.success(
        <div className="space-y-1">
          <p className="font-medium">AI generated event & markets!</p>
          {reasoning && (
            <p className="text-xs text-muted-foreground">{reasoning}</p>
          )}
        </div>
      );
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "AI generation failed");
    },
  });

  // Reset form to initial state from request
  const handleReset = () => {
    if (!request) return;

    const slug = request.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    setEventForm({
      title: request.title,
      slug,
      description: request.description,
      category: "OTHER" as MarketCategory,
      eventType: "PROP" as EventType,
      bannerUrl: "",
      logoUrl: "",
      startTime: "",
      endTime: "",
    });

    setMarkets([
      {
        ...createEmptyMarket(),
        question: request.title,
        resolutionSourceUrl: request.sourceUrl || "",
      },
    ]);

    setSelectedTagIds([]);
    setNewTags([]);
    setNewTagInput("");
    setIncludeMarkets(true);
    toast.info("Form reset to original request data");
  };

  // Form handlers
  const handleEventChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setEventForm((prev) => ({ ...prev, [name]: value }));

    // Auto-generate slug from title
    if (name === "title") {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      setEventForm((prev) => ({ ...prev, slug }));
    }
  };

  const handleMarketChange = (
    marketId: string,
    field: keyof MarketForm,
    value: string
  ) => {
    setMarkets((prev) =>
      prev.map((m) => (m.id === marketId ? { ...m, [field]: value } : m))
    );
  };

  const addMarket = () => {
    setMarkets((prev) => [...prev, createEmptyMarket()]);
  };

  const removeMarket = (marketId: string) => {
    if (markets.length <= 1) return;
    setMarkets((prev) => prev.filter((m) => m.id !== marketId));
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const addNewTag = () => {
    const trimmed = newTagInput.trim();
    if (!trimmed) return;

    // Generate slug
    const slug = trimmed
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Check if this tag already exists in the list of new tags
    if (newTags.some((t) => t.slug === slug)) {
      toast.error("This tag already exists");
      return;
    }

    // Check if this tag already exists in available tags
    if (availableTags.some((t) => t.slug === slug)) {
      // Just select the existing tag instead
      const existingTag = availableTags.find((t) => t.slug === slug);
      if (existingTag && !selectedTagIds.includes(existingTag.id)) {
        setSelectedTagIds((prev) => [...prev, existingTag.id]);
      }
      setNewTagInput("");
      toast.info("Selected existing tag");
      return;
    }

    setNewTags((prev) => [...prev, { label: trimmed, slug }]);
    setNewTagInput("");
  };

  const removeNewTag = (slug: string) => {
    setNewTags((prev) => prev.filter((t) => t.slug !== slug));
  };

  const handleNewTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addNewTag();
    }
  };

  const handleSaveStatus = () => {
    updateStatusMutation.mutate({
      status: requestStatus,
      adminNotes: adminNotes || undefined,
    });
  };

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.slug) {
      toast.error("Event title and slug are required");
      return;
    }
    if (markets.some((m) => !m.question)) {
      toast.error("All markets must have a question");
      return;
    }
    createEventMutation.mutate();
  };

  if (requestLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Request not found</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/admin/requests">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Requests
          </Link>
        </Button>
      </div>
    );
  }

  const StatusIcon = statusConfig[request.status].icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon">
          <Link href="/admin/requests">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" />
            Review Request
          </h1>
          <p className="text-sm text-muted-foreground">
            Review and create event/markets from this request
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Request Details & Status */}
        <div className="lg:col-span-1 space-y-6">
          {/* Request Details */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h2 className="text-lg font-semibold">Request Details</h2>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div>
                <h3 className="font-semibold text-lg">{request.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Submitted {format(new Date(request.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                </p>
              </div>

              <div className="flex items-center gap-3">
                {request.user.profileImageUrl ? (
                  <Image
                    src={request.user.profileImageUrl}
                    alt={request.user.name || "User"}
                    width={40}
                    height={40}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">
                    {request.user.name || request.user.handle || "Anonymous"}
                  </p>
                  {request.user.handle && (
                    <p className="text-sm text-muted-foreground">@{request.user.handle}</p>
                  )}
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm whitespace-pre-wrap">{request.description}</p>
              </div>

              {request.sourceUrl && (
                <div>
                  <Label className="text-xs text-muted-foreground">Reference URL</Label>
                  <a
                    href={request.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-primary hover:underline mt-1 break-all"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    {request.sourceUrl}
                  </a>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Status Update */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h2 className="text-lg font-semibold">Update Status</h2>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Current Status</Label>
                <Badge variant="outline" className={statusConfig[request.status].color}>
                  <StatusIcon className="h-3 w-3 mr-1" />
                  {statusConfig[request.status].label}
                </Badge>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">New Status</Label>
                <Select
                  value={requestStatus}
                  onValueChange={(v) => setRequestStatus(v as MarketRequest["status"])}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">
                      <span className="flex items-center gap-2">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    </SelectItem>
                    <SelectItem value="APPROVED">
                      <span className="flex items-center gap-2">
                        <CheckCircle className="h-3 w-3" /> Approved
                      </span>
                    </SelectItem>
                    <SelectItem value="REJECTED">
                      <span className="flex items-center gap-2">
                        <XCircle className="h-3 w-3" /> Rejected
                      </span>
                    </SelectItem>
                    <SelectItem value="CREATED">
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-3 w-3" /> Market Created
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminNotes">Admin Notes</Label>
                <Textarea
                  id="adminNotes"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes visible to the user..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  This will be visible to the user who submitted the request.
                </p>
              </div>

              <Button
                onClick={handleSaveStatus}
                disabled={updateStatusMutation.isPending}
                className="w-full"
                variant="outline"
              >
                {updateStatusMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Status Only
              </Button>
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Right Column - Create Event & Markets */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleCreateEvent} className="space-y-6">
            {/* Event Information */}
            <GlassCard variant="solid">
              <GlassCardHeader className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Create Event (Unpublished)</h2>
                  <p className="text-sm text-muted-foreground">
                    Create an unpublished event from this request
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    disabled={aiGenerateMutation.isPending}
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    onClick={() => aiGenerateMutation.mutate()}
                    disabled={aiGenerateMutation.isPending}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    {aiGenerateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Wand2 className="h-4 w-4 mr-1" />
                        Generate with AI
                      </>
                    )}
                  </Button>
                </div>
              </GlassCardHeader>
              
              {/* AI Generation Info Banner */}
              {aiGenerateMutation.isPending && (
                <div className="mx-6 mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="flex items-center gap-2 text-green-400">
                    <Brain className="h-4 w-4 animate-pulse" />
                    <span className="text-sm font-medium">
                      AI is researching and generating market details...
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Using GPT-4o to gather latest information and context from existing markets.
                  </p>
                </div>
              )}
              
              <GlassCardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Event Title *</Label>
                    <Input
                      id="title"
                      name="title"
                      value={eventForm.title}
                      onChange={handleEventChange}
                      placeholder="Super Bowl LIX"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug"
                      name="slug"
                      value={eventForm.slug}
                      onChange={handleEventChange}
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
                    value={eventForm.description}
                    onChange={handleEventChange}
                    placeholder="Brief description of the event..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select
                      value={eventForm.category}
                      onValueChange={(value) =>
                        setEventForm((prev) => ({
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
                    <Label htmlFor="eventType">Event Type</Label>
                    <Select
                      value={eventForm.eventType}
                      onValueChange={(value) =>
                        setEventForm((prev) => ({
                          ...prev,
                          eventType: value as EventType,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {eventTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startTime">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      Event Start Time
                    </Label>
                    <Input
                      id="startTime"
                      name="startTime"
                      type="datetime-local"
                      value={eventForm.startTime}
                      onChange={handleEventChange}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endTime">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      Event End Time
                    </Label>
                    <Input
                      id="endTime"
                      name="endTime"
                      type="datetime-local"
                      value={eventForm.endTime}
                      onChange={handleEventChange}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <ImageUpload
                    label="Banner Image"
                    value={eventForm.bannerUrl}
                    onChange={(url) => setEventForm((prev) => ({ ...prev, bannerUrl: url }))}
                    folder="events/banners"
                    aspectRatio="banner"
                    placeholder="https://..."
                  />
                  <ImageUpload
                    label="Logo Image"
                    value={eventForm.logoUrl}
                    onChange={(url) => setEventForm((prev) => ({ ...prev, logoUrl: url }))}
                    folder="events/logos"
                    aspectRatio="square"
                    placeholder="https://..."
                  />
                </div>
              </GlassCardContent>
            </GlassCard>

            {/* Tags */}
            <GlassCard variant="solid">
              <GlassCardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <TagIcon className="h-5 w-5" />
                  Tags
                </h2>
                <p className="text-sm text-muted-foreground">
                  Select existing tags or create new ones for categorization
                </p>
              </GlassCardHeader>
              <GlassCardContent className="space-y-4">
                {/* Create New Tag */}
                <div className="space-y-2">
                  <Label>Create New Tag</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={handleNewTagKeyDown}
                      placeholder="Enter tag name..."
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addNewTag}
                      disabled={!newTagInput.trim()}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>

                {/* New Tags to Create */}
                {newTags.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">New Tags (will be created)</Label>
                    <div className="flex flex-wrap gap-2">
                      {newTags.map((tag) => (
                        <Badge
                          key={tag.slug}
                          variant="default"
                          className="cursor-pointer bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30"
                          onClick={() => removeNewTag(tag.slug)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {tag.label}
                          <X className="h-3 w-3 ml-1" />
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Tags */}
                {availableTags.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">
                      Existing Tags ({selectedTagIds.length} selected)
                    </Label>
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
                  </div>
                )}

                {availableTags.length === 0 && newTags.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No tags available. Create a new one above.
                  </p>
                )}
              </GlassCardContent>
            </GlassCard>

            {/* Markets */}
            <GlassCard variant="solid">
              <GlassCardHeader className="flex flex-col gap-4">
                <div className="flex flex-row items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Markets (Optional)</h2>
                    <p className="text-sm text-muted-foreground">
                      Create markets now or add them later from the event page
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="include-markets"
                      checked={includeMarkets}
                      onCheckedChange={setIncludeMarkets}
                    />
                    <Label htmlFor="include-markets" className="text-sm font-medium cursor-pointer">
                      {includeMarkets ? "Include Markets" : "Event Only"}
                    </Label>
                  </div>
                </div>
                {includeMarkets && (
                  <Button type="button" variant="outline" size="sm" onClick={addMarket} className="w-fit">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Market
                  </Button>
                )}
              </GlassCardHeader>
              <GlassCardContent className="space-y-6">
                {!includeMarkets && (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>Markets will not be created with this event.</p>
                    <p className="text-sm">You can add markets later from the event management page.</p>
                  </div>
                )}
                {includeMarkets && markets.map((market, index) => (
                  <div key={market.id} className="space-y-4">
                    {index > 0 && <Separator />}
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium">Market {index + 1}</h3>
                      {markets.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMarket(market.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Question *</Label>
                      <Input
                        value={market.question}
                        onChange={(e) =>
                          handleMarketChange(market.id, "question", e.target.value)
                        }
                        placeholder="Who will win?"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Outcome 1</Label>
                        <Input
                          value={market.outcome0Label}
                          onChange={(e) =>
                            handleMarketChange(market.id, "outcome0Label", e.target.value)
                          }
                          placeholder="Yes"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Outcome 2</Label>
                        <Input
                          value={market.outcome1Label}
                          onChange={(e) =>
                            handleMarketChange(market.id, "outcome1Label", e.target.value)
                          }
                          placeholder="No"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Details (Markdown)</Label>
                      <Textarea
                        value={market.detailsMarkdown}
                        onChange={(e) =>
                          handleMarketChange(market.id, "detailsMarkdown", e.target.value)
                        }
                        placeholder="Additional details about this market..."
                        rows={2}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Resolution Source URL</Label>
                      <Input
                        value={market.resolutionSourceUrl}
                        onChange={(e) =>
                          handleMarketChange(market.id, "resolutionSourceUrl", e.target.value)
                        }
                        placeholder="https://..."
                        type="url"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Opens At</Label>
                        <Input
                          type="datetime-local"
                          value={market.opensAt}
                          onChange={(e) =>
                            handleMarketChange(market.id, "opensAt", e.target.value)
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Closes At</Label>
                        <Input
                          type="datetime-local"
                          value={market.closesAt}
                          onChange={(e) =>
                            handleMarketChange(market.id, "closesAt", e.target.value)
                          }
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Fee (basis points)</Label>
                        <Input
                          type="number"
                          value={market.feeBps}
                          onChange={(e) =>
                            handleMarketChange(market.id, "feeBps", e.target.value)
                          }
                          placeholder="100"
                        />
                        <p className="text-xs text-muted-foreground">100 = 1% fee</p>
                      </div>
                      <div className="space-y-2">
                        <Label>Seed Liquidity 1</Label>
                        <Input
                          type="number"
                          value={market.seed0}
                          onChange={(e) =>
                            handleMarketChange(market.id, "seed0", e.target.value)
                          }
                          placeholder="1000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Seed Liquidity 2</Label>
                        <Input
                          type="number"
                          value={market.seed1}
                          onChange={(e) =>
                            handleMarketChange(market.id, "seed1", e.target.value)
                          }
                          placeholder="1000"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </GlassCardContent>
            </GlassCard>

            {/* Submit */}
            <div className="flex flex-col sm:flex-row justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createEventMutation.isPending}
                className="bg-primary"
              >
                {createEventMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <Sparkles className="h-4 w-4 mr-2" />
                {includeMarkets ? "Create Event & Markets" : "Create Event Only"}
              </Button>
            </div>

            {createEventMutation.isError && (
              <p className="text-destructive text-sm text-center">
                {createEventMutation.error instanceof Error
                  ? createEventMutation.error.message
                  : "An error occurred"}
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
