"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch, Badge } from "@vault/ui";
import { Loader2 } from "lucide-react";

interface PublishToggleProps {
  id: string;
  type: "event" | "market";
  isPublished: boolean;
  onToggle?: (newValue: boolean) => void;
  disabled?: boolean;
  showLabel?: boolean;
}

export function PublishToggle({
  id,
  type,
  isPublished,
  onToggle,
  disabled = false,
  showLabel = true,
}: PublishToggleProps) {
  const [optimisticValue, setOptimisticValue] = useState(isPublished);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const endpoint =
        type === "event"
          ? `/api/admin/events/${id}/publish`
          : `/api/admin/markets/${id}/publish`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: newValue }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update publish status");
      }

      return res.json();
    },
    onMutate: async (newValue) => {
      setOptimisticValue(newValue);
    },
    onError: (error, newValue) => {
      // Revert optimistic update
      setOptimisticValue(!newValue);
      console.error("Error toggling publish status:", error);
      alert(error instanceof Error ? error.message : "Failed to update");
    },
    onSuccess: (data, newValue) => {
      onToggle?.(newValue);
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["admin", type + "s"] });
      queryClient.invalidateQueries({ queryKey: ["admin", type, id] });
    },
  });

  const handleToggle = (checked: boolean) => {
    mutation.mutate(checked);
  };

  return (
    <div className="flex items-center gap-2">
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch
          checked={optimisticValue}
          onCheckedChange={handleToggle}
          disabled={disabled || mutation.isPending}
        />
      )}
      {showLabel && (
        <Badge
          variant={optimisticValue ? "success" : "secondary"}
          className="text-xs"
        >
          {optimisticValue ? "Published" : "Draft"}
        </Badge>
      )}
    </div>
  );
}
