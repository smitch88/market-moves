"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  toast,
} from "@vault/ui";
import { ImageUpload } from "@/components/admin";
import {
  Loader2,
  Database,
  Plus,
  ExternalLink,
  Globe,
  Server,
  GitMerge,
  CheckCircle,
  XCircle,
  Eye,
  Settings,
  FileJson,
} from "lucide-react";

interface ResolutionSource {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  type: "INTERNAL" | "EXTERNAL" | "HYBRID";
  logoUrl: string | null;
  websiteUrl: string | null;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
  _count: {
    markets: number;
    dataPoints: number;
  };
}

const typeConfig = {
  INTERNAL: {
    label: "Internal",
    description: "Vault Markets is the authoritative source",
    icon: Server,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  EXTERNAL: {
    label: "External",
    description: "External API/website is the source",
    icon: Globe,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  },
  HYBRID: {
    label: "Hybrid",
    description: "Both internal and external verification",
    icon: GitMerge,
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
};

export default function AdminResolutionSourcesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    slug: "",
    name: "",
    description: "",
    type: "INTERNAL" as "INTERNAL" | "EXTERNAL" | "HYBRID",
    externalApiUrl: "",
    logoUrl: "",
    websiteUrl: "",
    isActive: true,
    isPublic: true,
  });

  const { data, isLoading } = useQuery<{ sources: ResolutionSource[] }>({
    queryKey: ["adminResolutionSources"],
    queryFn: async () => {
      const res = await fetch("/api/admin/resolution-sources?includeInactive=true");
      if (!res.ok) throw new Error("Failed to fetch resolution sources");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/admin/resolution-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          externalApiUrl: formData.externalApiUrl || undefined,
          logoUrl: formData.logoUrl || undefined,
          websiteUrl: formData.websiteUrl || undefined,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create resolution source");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success("Resolution source created successfully");
      queryClient.invalidateQueries({ queryKey: ["adminResolutionSources"] });
      setCreateDialogOpen(false);
      resetForm();
      router.push(`/admin/resolution-sources/${data.source.id}`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create");
    },
  });

  const resetForm = () => {
    setFormData({
      slug: "",
      name: "",
      description: "",
      type: "INTERNAL",
      externalApiUrl: "",
      logoUrl: "",
      websiteUrl: "",
      isActive: true,
      isPublic: true,
    });
  };

  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    setFormData((prev) => ({ ...prev, name, slug }));
  };

  const sources = data?.sources || [];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Database className="h-7 w-7 text-primary" />
            Resolution Sources
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage resolution authorities and data sources for market outcomes
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Source
        </Button>
      </div>

      {/* Public API Info */}
      <GlassCard variant="solid">
        <GlassCardContent className="p-4">
          <div className="flex items-start gap-3">
            <FileJson className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-medium">Public API Available</p>
              <p className="text-sm text-muted-foreground">
                Public resolution sources are accessible via the API at{" "}
                <code className="bg-muted px-1 py-0.5 rounded text-xs">
                  /api/resolution-sources
                </code>
              </p>
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>

      {/* Sources List */}
      <GlassCard variant="solid">
        <GlassCardHeader>
          <h2 className="text-lg font-semibold">All Sources ({sources.length})</h2>
        </GlassCardHeader>
        <GlassCardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sources.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No resolution sources yet</p>
              <p className="text-sm">Create one to start tracking resolution data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => {
                const config = typeConfig[source.type];
                const TypeIcon = config.icon;

                return (
                  <Link
                    key={source.id}
                    href={`/admin/resolution-sources/${source.id}`}
                    className="block p-4 rounded-lg border border-border bg-card/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{source.name}</h3>
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
                          {source.isPublic && (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                              <Eye className="h-3 w-3 mr-1" />
                              Public
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {source.description || "No description"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                          <code className="bg-muted px-1 py-0.5 rounded">{source.slug}</code>
                          {" · "}
                          {source._count.markets} markets · {source._count.dataPoints} data points
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {source.websiteUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <a href={source.websiteUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                        <Settings className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Create Resolution Source
            </DialogTitle>
            <DialogDescription>
              Add a new resolution authority for market outcomes
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Vault Markets Official"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, slug: e.target.value }))
                }
                placeholder="vault-markets"
                pattern="^[a-z0-9-]+$"
                required
              />
              <p className="text-xs text-muted-foreground">
                Used in API URLs: /api/resolution-sources/{formData.slug || "slug"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Official resolution source for..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Source Type</Label>
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
                  {Object.entries(typeConfig).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <Icon className="h-4 w-4" />
                          {config.label} - {config.description}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {(formData.type === "EXTERNAL" || formData.type === "HYBRID") && (
              <div className="space-y-2">
                <Label htmlFor="externalApiUrl">External API URL</Label>
                <Input
                  id="externalApiUrl"
                  type="url"
                  value={formData.externalApiUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, externalApiUrl: e.target.value }))
                  }
                  placeholder="https://api.example.com/data"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="websiteUrl">Website URL</Label>
              <Input
                id="websiteUrl"
                type="url"
                value={formData.websiteUrl}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, websiteUrl: e.target.value }))
                }
                placeholder="https://..."
              />
            </div>

            <ImageUpload
              label="Logo Image"
              value={formData.logoUrl}
              onChange={(url) => setFormData((prev) => ({ ...prev, logoUrl: url }))}
              folder="resolution-sources/logos"
              aspectRatio="square"
              placeholder="https://..."
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, isActive: v }))
                  }
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isPublic"
                  checked={formData.isPublic}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, isPublic: v }))
                  }
                />
                <Label htmlFor="isPublic">Public API Access</Label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create Source
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
