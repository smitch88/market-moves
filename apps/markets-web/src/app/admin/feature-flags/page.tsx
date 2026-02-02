"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Input,
  Button,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Label,
  Textarea,
  toast,
} from "@vault/ui";
import {
  Loader2,
  Flag,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Shield,
  Power,
  PowerOff,
} from "lucide-react";

type FeatureFlagStatus = "OFF" | "ON" | "ADMIN_ONLY";

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: FeatureFlagStatus;
  createdAt: string;
  updatedAt: string;
}

const statusConfig: Record<FeatureFlagStatus, { label: string; color: string; icon: React.ReactNode }> = {
  OFF: { 
    label: "Off", 
    color: "bg-zinc-500/20 text-zinc-400",
    icon: <PowerOff className="h-3 w-3" />,
  },
  ON: { 
    label: "On", 
    color: "bg-green-500/20 text-green-400",
    icon: <Power className="h-3 w-3" />,
  },
  ADMIN_ONLY: { 
    label: "Admin Only", 
    color: "bg-amber-500/20 text-amber-400",
    icon: <Shield className="h-3 w-3" />,
  },
};

export default function AdminFeatureFlagsPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFlag, setEditingFlag] = useState<FeatureFlag | null>(null);
  const [deleteFlag, setDeleteFlag] = useState<FeatureFlag | null>(null);
  
  // Form state
  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<FeatureFlagStatus>("OFF");

  const { data, isLoading } = useQuery({
    queryKey: ["adminFeatureFlags"],
    queryFn: async () => {
      const res = await fetch("/api/admin/feature-flags");
      if (!res.ok) throw new Error("Failed to fetch feature flags");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { key: string; name: string; description?: string; status: FeatureFlagStatus }) => {
      const res = await fetch("/api/admin/feature-flags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create feature flag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] });
      setIsCreateOpen(false);
      resetForm();
      toast.success("Feature flag created");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ key, data }: { key: string; data: { name?: string; description?: string | null; status?: FeatureFlagStatus } }) => {
      const res = await fetch(`/api/admin/feature-flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update feature flag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] });
      setEditingFlag(null);
      resetForm();
      toast.success("Feature flag updated");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => {
      const res = await fetch(`/api/admin/feature-flags/${key}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete feature flag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] });
      setDeleteFlag(null);
      toast.success("Feature flag deleted");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ key, newStatus }: { key: string; newStatus: FeatureFlagStatus }) => {
      const res = await fetch(`/api/admin/feature-flags/${key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update feature flag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminFeatureFlags"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const flags: FeatureFlag[] = data?.flags || [];

  const resetForm = () => {
    setFormKey("");
    setFormName("");
    setFormDescription("");
    setFormStatus("OFF");
  };

  const openEditDialog = (flag: FeatureFlag) => {
    setEditingFlag(flag);
    setFormName(flag.name);
    setFormDescription(flag.description || "");
    setFormStatus(flag.status);
  };

  const handleCreate = () => {
    createMutation.mutate({
      key: formKey,
      name: formName,
      description: formDescription || undefined,
      status: formStatus,
    });
  };

  const handleUpdate = () => {
    if (!editingFlag) return;
    updateMutation.mutate({
      key: editingFlag.key,
      data: {
        name: formName,
        description: formDescription || null,
        status: formStatus,
      },
    });
  };

  const cycleStatus = (flag: FeatureFlag) => {
    const statusOrder: FeatureFlagStatus[] = ["OFF", "ADMIN_ONLY", "ON"];
    const currentIndex = statusOrder.indexOf(flag.status);
    const nextIndex = (currentIndex + 1) % statusOrder.length;
    toggleStatusMutation.mutate({ key: flag.key, newStatus: statusOrder[nextIndex] });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Flag className="h-7 w-7 text-primary" />
            Feature Flags
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Control feature rollout and availability
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Flag
        </Button>
      </div>

      {/* Status Legend */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(statusConfig).map(([status, config]) => (
          <div key={status} className="flex items-center gap-2 text-sm">
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${config.color}`}>
              {config.icon}
              {config.label}
            </span>
          </div>
        ))}
      </div>

      {/* Flags List */}
      <GlassCard variant="solid">
        <GlassCardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : flags.length === 0 ? (
            <div className="p-12 text-center">
              <Flag className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-muted-foreground">No feature flags yet</p>
              <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first flag
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {flags.map((flag) => (
                <div
                  key={flag.id}
                  className="p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-semibold">{flag.name}</h3>
                        <Badge variant="outline" className="font-mono text-xs">
                          {flag.key}
                        </Badge>
                      </div>
                      {flag.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {flag.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Updated {format(new Date(flag.updatedAt), "MMM d, yyyy HH:mm")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Status Toggle Button */}
                      <button
                        onClick={() => cycleStatus(flag)}
                        disabled={toggleStatusMutation.isPending}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium text-sm transition-colors ${statusConfig[flag.status].color} hover:opacity-80`}
                      >
                        {statusConfig[flag.status].icon}
                        {statusConfig[flag.status].label}
                      </button>
                      
                      {/* Edit Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(flag)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      
                      {/* Delete Button */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteFlag(flag)}
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

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Feature Flag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                placeholder="feature_name"
                value={formKey}
                onChange={(e) => setFormKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_"))}
              />
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and underscores only
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My Feature"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="What does this flag control?"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Initial Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as FeatureFlagStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFF">
                    <span className="flex items-center gap-2">
                      <PowerOff className="h-3 w-3" />
                      Off
                    </span>
                  </SelectItem>
                  <SelectItem value="ADMIN_ONLY">
                    <span className="flex items-center gap-2">
                      <Shield className="h-3 w-3" />
                      Admin Only
                    </span>
                  </SelectItem>
                  <SelectItem value="ON">
                    <span className="flex items-center gap-2">
                      <Power className="h-3 w-3" />
                      On
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreate} 
              disabled={!formKey || !formName || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingFlag} onOpenChange={(open) => !open && setEditingFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Feature Flag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Key</Label>
              <Input value={editingFlag?.key || ""} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Keys cannot be changed</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-status">Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as FeatureFlagStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFF">
                    <span className="flex items-center gap-2">
                      <PowerOff className="h-3 w-3" />
                      Off
                    </span>
                  </SelectItem>
                  <SelectItem value="ADMIN_ONLY">
                    <span className="flex items-center gap-2">
                      <Shield className="h-3 w-3" />
                      Admin Only
                    </span>
                  </SelectItem>
                  <SelectItem value="ON">
                    <span className="flex items-center gap-2">
                      <Power className="h-3 w-3" />
                      On
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingFlag(null); resetForm(); }}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpdate} 
              disabled={!formName || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteFlag} onOpenChange={(open) => !open && setDeleteFlag(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Feature Flag</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete the feature flag <strong>{deleteFlag?.name}</strong> ({deleteFlag?.key})?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteFlag(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={() => deleteFlag && deleteMutation.mutate(deleteFlag.key)} 
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

