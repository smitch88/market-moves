"use client";

import { useTheme } from "next-themes";
import { Toaster } from "@vault/ui";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();

  return (
    <Toaster
      position="bottom-center"
      theme={resolvedTheme as "light" | "dark" | "system"}
      richColors
      closeButton
    />
  );
}
