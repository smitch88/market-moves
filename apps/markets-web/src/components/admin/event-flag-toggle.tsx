"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Switch } from "@vault/ui";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface EventFlagToggleProps {
  eventId: string;
  flag: "pinned" | "featured";
  value: boolean;
}

export function EventFlagToggle({ eventId, flag, value }: EventFlagToggleProps) {
  const [optimisticValue, setOptimisticValue] = useState(value);
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const res = await fetch(`/api/admin/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [flag]: newValue }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || `Failed to update ${flag} status`);
      }

      return res.json();
    },
    onMutate: async (newValue) => {
      setOptimisticValue(newValue);
    },
    onError: (error, newValue) => {
      // Revert optimistic update
      setOptimisticValue(!newValue);
      console.error(`Error toggling ${flag} status:`, error);
    },
    onSuccess: () => {
      // Refresh the page to reflect changes
      router.refresh();
    },
  });

  const handleToggle = (checked: boolean) => {
    mutation.mutate(checked);
  };

  return (
    <div className="flex items-center justify-center">
      {mutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <Switch
          checked={optimisticValue}
          onCheckedChange={handleToggle}
          disabled={mutation.isPending}
          className="data-[state=checked]:bg-primary"
        />
      )}
    </div>
  );
}
