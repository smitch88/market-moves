"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Badge,
  Input,
  GlassCard,
  GlassCardContent,
  GlassCardHeader,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Label,
} from "@vault/ui";
import { Plus, Pencil, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

interface Tag {
  id: string;
  slug: string;
  label: string;
  eventCount: number;
  createdAt: string;
  updatedAt: string;
}

export default function AdminTagsPage() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null);
  const [formData, setFormData] = useState({ label: "", slug: "" });

  // Fetch tags
  const { data, isLoading } = useQuery({
    queryKey: ["adminTags"],
    queryFn: async () => {
      const res = await fetch("/api/admin/tags");
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
  });

  const tags: Tag[] = data?.tags || [];

  // Create tag mutation
  const createMutation = useMutation({
    mutationFn: async (data: { label: string; slug?: string }) => {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to create tag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminTags"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setCreateDialogOpen(false);
      setFormData({ label: "", slug: "" });
    },
  });

  // Update tag mutation
  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; label?: string; slug?: string }) => {
      const res = await fetch(`/api/admin/tags/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: data.label, slug: data.slug }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update tag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminTags"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setEditDialogOpen(false);
      setSelectedTag(null);
      setFormData({ label: "", slug: "" });
    },
  });

  // Delete tag mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/tags/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete tag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adminTags"] });
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      setDeleteDialogOpen(false);
      setSelectedTag(null);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      label: formData.label,
      slug: formData.slug || undefined,
    });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTag) return;
    updateMutation.mutate({
      id: selectedTag.id,
      label: formData.label,
      slug: formData.slug,
    });
  };

  const handleDeleteConfirm = () => {
    if (!selectedTag) return;
    deleteMutation.mutate(selectedTag.id);
  };

  const openEditDialog = (tag: Tag) => {
    setSelectedTag(tag);
    setFormData({ label: tag.label, slug: tag.slug });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (tag: Tag) => {
    setSelectedTag(tag);
    setDeleteDialogOpen(true);
  };

  // Auto-generate slug from label when creating
  const handleLabelChange = (value: string, isCreate: boolean) => {
    setFormData((prev) => ({
      ...prev,
      label: value,
      ...(isCreate && {
        slug: value
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      }),
    }));
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tags</h1>
          <p className="text-muted-foreground">
            Manage tags for categorizing events
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Tag
        </Button>
      </div>

      <GlassCard>
        <GlassCardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Label
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Slug
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Events
                    </th>
                    <th className="text-left p-4 font-medium text-muted-foreground">
                      Created
                    </th>
                    <th className="text-right p-4 font-medium text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => (
                    <tr
                      key={tag.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <Badge variant="secondary">{tag.label}</Badge>
                      </td>
                      <td className="p-4">
                        <code className="text-sm text-muted-foreground">
                          {tag.slug}
                        </code>
                      </td>
                      <td className="p-4">{tag.eventCount}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {format(new Date(tag.createdAt), "MMM d, yyyy")}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(tag)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(tag)}
                            disabled={tag.eventCount > 0}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {tags.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No tags yet. Create your first tag!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
            <DialogDescription>
              Create a new tag to categorize events
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-label">Label</Label>
                <Input
                  id="create-label"
                  value={formData.label}
                  onChange={(e) => handleLabelChange(e.target.value, true)}
                  placeholder="Sports"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-slug">Slug</Label>
                <Input
                  id="create-slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="sports"
                />
                <p className="text-xs text-muted-foreground">
                  Auto-generated from label if left empty
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialogOpen(false);
                  setFormData({ label: "", slug: "" });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
            {createMutation.isError && (
              <p className="text-destructive text-sm text-center mt-2">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : "Failed to create tag"}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Tag</DialogTitle>
            <DialogDescription>Update the tag label or slug</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-label">Label</Label>
                <Input
                  id="edit-label"
                  value={formData.label}
                  onChange={(e) => handleLabelChange(e.target.value, false)}
                  placeholder="Sports"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-slug">Slug</Label>
                <Input
                  id="edit-slug"
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, slug: e.target.value }))
                  }
                  placeholder="sports"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialogOpen(false);
                  setSelectedTag(null);
                  setFormData({ label: "", slug: "" });
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
            {updateMutation.isError && (
              <p className="text-destructive text-sm text-center mt-2">
                {updateMutation.error instanceof Error
                  ? updateMutation.error.message
                  : "Failed to update tag"}
              </p>
            )}
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Tag
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the tag &quot;{selectedTag?.label}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSelectedTag(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
          {deleteMutation.isError && (
            <p className="text-destructive text-sm text-center">
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : "Failed to delete tag"}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
