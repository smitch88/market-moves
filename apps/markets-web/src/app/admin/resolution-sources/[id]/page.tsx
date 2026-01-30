"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Separator,
  toast,
} from "@vault/ui";
import {
  Loader2,
  ArrowLeft,
  Database,
  Plus,
  ExternalLink,
  Globe,
  Server,
  GitMerge,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  FileJson,
  Link as LinkIcon,
  Save,
  ShieldCheck,
} from "lucide-react";

interface ResolutionSource {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: "INTERNAL" | "EXTERNAL" | "HYBRID";
  externalApiUrl: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  markets: Array<{
    id: string;
    question: string;
    status: string;
    event: {
      id: string;
      title: string;
      slug: string;
    };
  }>;
  dataPoints: Array<{
    id: string;
    key: string;
    label: string | null;
    value: string;
    valueType: string;
    isVerified: boolean;
    verifiedAt: string | null;
    effectiveAt: string;
    expiresAt: string | null;
    marketId: string | null;
  }>;
  _count: {
    markets: number;
    dataPoints: number;
  };
}

const typeConfig = {
  INTERNAL: {
    label: "Internal",
    icon: Server,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  EXTERNAL: {
    label: "External",
    icon: Globe,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
  HYBRID: {
    label: "Hybrid",
    icon: GitMerge,
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
};

export default function AdminResolutionSourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "INTERNAL" as "INTERNAL" | "EXTERNAL" | "HYBRID",
    externalApiUrl: "",
    logoUrl: "",
    websiteUrl: "",
    isActive: true,
    isPublic: true,
  });

  const [addDataDialogOpen, setAddDataDialogOpen] = useState(false);
  const [newDataPoint, setNewDataPoint] = useState({
    key: "",
    label: "",
    value: "",
    valueType: "string" as "string" | "number" | "boolean" | "json",
    marketId: "",
    notes: "",
  });

  const { data, isLoading } = useQuery<{ source: ResolutionSource }>({
    queryKey: ["adminResolutionSource", id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/resolution-sources/${id}`);
      if (!res.ok) throw new Error("Failed to fetch resolution source");
      const data = await res.json();
      // Initialize form data
      setFormData({
        name: data.source.name,
        description: data.source.description || "",
        type: data.source.type,
        externalApiUrl: data.source.externalApiUrl || "",
        logoUrl: data.source.logoUrl || "",
        websiteUrl: data.source.websiteUrl || "",
        isActive: data.source.isActive,
        isPublic: data.source.isPublic,
      });
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/resolution-sources/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          type: formData.type,
          externalApiUrl: formData.externalApiUrl || null,
          logoUrl: formData.logoUrl || null,
          websiteUrl: formData.websiteUrl || null,
          isActive: formData.isActive,
          isPublic: formData.isPublic,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Resolution source updated");
      queryClient.invalidateQueries({ queryKey: ["adminResolutionSource", id] });
      setEditMode(false);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to update");
    },
  });

  const addDataPointMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/resolution-sources/${id}/data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newDataPoint.key,
          label: newDataPoint.label || undefined,
          value: newDataPoint.value,
          valueType: newDataPoint.valueType,
          marketId: newDataPoint.marketId || undefined,
          notes: newDataPoint.notes || undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add data point");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Data point added");
      queryClient.invalidateQueries({ queryKey: ["adminResolutionSource", id] });
      setAddDataDialogOpen(false);
      setNewDataPoint({
        key: "",
        label: "",
        value: "",
        valueType: "string",
        marketId: "",
        notes: "",
      });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to add data point");
    },
  });

  const verifyDataPointMutation = useMutation({
    mutationFn: async (dataPointId: string) => {
      const res = await fetch(`/api/admin/resolution-sources/${id}/data/${dataPointId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isVerified: true }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to verify");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Data point verified");
      queryClient.invalidateQueries({ queryKey: ["adminResolutionSource", id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to verify");
    },
  });

  const deleteDataPointMutation = useMutation({
    mutationFn: async (dataPointId: string) => {
      const res = await fetch(`/api/admin/resolution-sources/${id}/data/${dataPointId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Data point deleted");
      queryClient.invalidateQueries({ queryKey: ["adminResolutionSource", id] });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data?.source) {
    return (
      <div className="text-center py-24 text-muted-foreground">
        <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Resolution source not found</p>
      </div>
    );
  }

  const source = data.source;
  const config = typeConfig[source.type];
  const TypeIcon = config.icon;
  const apiUrl = typeof window !== "undefined" 
    ? `${window.location.origin}/api/resolution-sources/${source.slug}`
    : `/api/resolution-sources/${source.slug}`;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/admin/resolution-sources")}
          className="w-fit"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sources
        </Button>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
              <Database className="h-7 w-7 text-primary" />
              {source.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={config.color}>
                <TypeIcon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              {source.isActive ? (
                <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">
                  <XCircle className="h-3 w-3 mr-1" />
                  Inactive
                </Badge>
              )}
              {source.isPublic ? (
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  <Eye className="h-3 w-3 mr-1" />
                  Public
                </Badge>
              ) : (
                <Badge variant="outline">
                  <EyeOff className="h-3 w-3 mr-1" />
                  Private
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {editMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditMode(false);
                    // Reset form data
                    setFormData({
                      name: source.name,
                      description: source.description || "",
                      type: source.type,
                      externalApiUrl: source.externalApiUrl || "",
                      logoUrl: source.logoUrl || "",
                      websiteUrl: source.websiteUrl || "",
                      isActive: source.isActive,
                      isPublic: source.isPublic,
                    });
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </Button>
              </>
            ) : (
              <Button onClick={() => setEditMode(true)}>Edit Source</Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Source Details */}
        <div className="lg:col-span-1 space-y-6">
          {/* API Info */}
          {source.isPublic && (
            <GlassCard variant="solid">
              <GlassCardHeader>
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <FileJson className="h-5 w-5" />
                  Public API
                </h2>
              </GlassCardHeader>
              <GlassCardContent className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">API Endpoint</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded overflow-x-auto">
                      {apiUrl}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(apiUrl)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Data Endpoint</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded overflow-x-auto">
                      {apiUrl}/data
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(`${apiUrl}/data`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </GlassCardContent>
            </GlassCard>
          )}

          {/* Source Settings */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h2 className="text-lg font-semibold">Source Settings</h2>
            </GlassCardHeader>
            <GlassCardContent className="space-y-4">
              {editMode ? (
                <>
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, description: e.target.value }))
                      }
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <Select
                      value={formData.type}
                      onValueChange={(v) =>
                        setFormData((prev) => ({
                          ...prev,
                          type: v as "INTERNAL" | "EXTERNAL" | "HYBRID",
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="INTERNAL">Internal</SelectItem>
                        <SelectItem value="EXTERNAL">External</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {(formData.type === "EXTERNAL" || formData.type === "HYBRID") && (
                    <div className="space-y-2">
                      <Label>External API URL</Label>
                      <Input
                        type="url"
                        value={formData.externalApiUrl}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, externalApiUrl: e.target.value }))
                        }
                      />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Website URL</Label>
                    <Input
                      type="url"
                      value={formData.websiteUrl}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, websiteUrl: e.target.value }))
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={formData.isActive}
                      onCheckedChange={(v) =>
                        setFormData((prev) => ({ ...prev, isActive: v }))
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Public API</Label>
                    <Switch
                      checked={formData.isPublic}
                      onCheckedChange={(v) =>
                        setFormData((prev) => ({ ...prev, isPublic: v }))
                      }
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Slug</Label>
                    <p className="font-mono text-sm">{source.slug}</p>
                  </div>
                  {source.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Description</Label>
                      <p className="text-sm">{source.description}</p>
                    </div>
                  )}
                  {source.externalApiUrl && (
                    <div>
                      <Label className="text-xs text-muted-foreground">External API</Label>
                      <a
                        href={source.externalApiUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {source.externalApiUrl}
                      </a>
                    </div>
                  )}
                  {source.websiteUrl && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Website</Label>
                      <a
                        href={source.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        <Globe className="h-3 w-3" />
                        {source.websiteUrl}
                      </a>
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    Created {format(new Date(source.createdAt), "MMM d, yyyy")}
                  </div>
                </>
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Linked Markets */}
          <GlassCard variant="solid">
            <GlassCardHeader>
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Linked Markets ({source._count.markets})
              </h2>
            </GlassCardHeader>
            <GlassCardContent>
              {source.markets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No markets linked</p>
              ) : (
                <div className="space-y-2">
                  {source.markets.map((market) => (
                    <Link
                      key={market.id}
                      href={`/admin/events/${market.event.id}`}
                      className="block p-2 rounded bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <p className="text-sm font-medium line-clamp-1">{market.question}</p>
                      <p className="text-xs text-muted-foreground">{market.event.title}</p>
                    </Link>
                  ))}
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Right Column - Data Points */}
        <div className="lg:col-span-2">
          <GlassCard variant="solid">
            <GlassCardHeader className="flex flex-row items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Data Points ({source._count.dataPoints})</h2>
                <p className="text-sm text-muted-foreground">
                  Resolution data stored for this source
                </p>
              </div>
              <Button onClick={() => setAddDataDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Data
              </Button>
            </GlassCardHeader>
            <GlassCardContent>
              {source.dataPoints.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileJson className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No data points yet</p>
                  <p className="text-sm">Add resolution data for markets</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {source.dataPoints.map((dp) => (
                    <div
                      key={dp.id}
                      className="p-4 rounded-lg border border-border bg-card/50"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="text-sm font-medium bg-muted px-1.5 py-0.5 rounded">
                              {dp.key}
                            </code>
                            <Badge variant="outline" className="text-xs">
                              {dp.valueType}
                            </Badge>
                            {dp.isVerified ? (
                              <Badge
                                variant="outline"
                                className="bg-green-500/10 text-green-500 border-green-500/20"
                              >
                                <ShieldCheck className="h-3 w-3 mr-1" />
                                Verified
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                Pending
                              </Badge>
                            )}
                          </div>
                          {dp.label && (
                            <p className="text-sm text-muted-foreground">{dp.label}</p>
                          )}
                          <p className="font-mono text-sm mt-1 bg-muted px-2 py-1 rounded inline-block">
                            {dp.value}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            Effective: {format(new Date(dp.effectiveAt), "MMM d, yyyy HH:mm")}
                            {dp.verifiedAt && (
                              <> · Verified: {format(new Date(dp.verifiedAt), "MMM d, yyyy")}</>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          {!dp.isVerified && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => verifyDataPointMutation.mutate(dp.id)}
                              disabled={verifyDataPointMutation.isPending}
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm("Delete this data point?")) {
                                deleteDataPointMutation.mutate(dp.id);
                              }
                            }}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>

      {/* Add Data Point Dialog */}
      <Dialog open={addDataDialogOpen} onOpenChange={setAddDataDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Add Data Point
            </DialogTitle>
            <DialogDescription>
              Add resolution data to this source
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addDataPointMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="key">Key *</Label>
                <Input
                  id="key"
                  value={newDataPoint.key}
                  onChange={(e) =>
                    setNewDataPoint((prev) => ({ ...prev, key: e.target.value }))
                  }
                  placeholder="btc_price_2024"
                  pattern="^[a-z0-9_-]+$"
                  required
                />
                <p className="text-xs text-muted-foreground">Lowercase, underscores, hyphens</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valueType">Value Type</Label>
                <Select
                  value={newDataPoint.valueType}
                  onValueChange={(v) =>
                    setNewDataPoint((prev) => ({
                      ...prev,
                      valueType: v as "string" | "number" | "boolean" | "json",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="string">String</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                    <SelectItem value="json">JSON</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Label (Human-readable)</Label>
              <Input
                id="label"
                value={newDataPoint.label}
                onChange={(e) =>
                  setNewDataPoint((prev) => ({ ...prev, label: e.target.value }))
                }
                placeholder="Bitcoin Price EOY 2024"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="value">Value *</Label>
              <Textarea
                id="value"
                value={newDataPoint.value}
                onChange={(e) =>
                  setNewDataPoint((prev) => ({ ...prev, value: e.target.value }))
                }
                placeholder={
                  newDataPoint.valueType === "json"
                    ? '{"winner": "Team A"}'
                    : newDataPoint.valueType === "boolean"
                    ? "true"
                    : newDataPoint.valueType === "number"
                    ? "42000.50"
                    : "Resolution value"
                }
                rows={2}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Internal)</Label>
              <Textarea
                id="notes"
                value={newDataPoint.notes}
                onChange={(e) =>
                  setNewDataPoint((prev) => ({ ...prev, notes: e.target.value }))
                }
                placeholder="Internal notes about this data point..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAddDataDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={addDataPointMutation.isPending}>
                {addDataPointMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Add Data Point
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
