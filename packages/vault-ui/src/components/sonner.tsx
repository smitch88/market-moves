"use client"

import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ ...props }: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          error: "group-[.toaster]:bg-destructive/10 group-[.toaster]:border-destructive/30 group-[.toaster]:text-destructive",
          success: "group-[.toaster]:bg-outcome-yes/10 group-[.toaster]:border-outcome-yes/30 group-[.toaster]:text-outcome-yes",
          warning: "group-[.toaster]:bg-amber-500/10 group-[.toaster]:border-amber-500/30 group-[.toaster]:text-amber-500",
          info: "group-[.toaster]:bg-primary/10 group-[.toaster]:border-primary/30 group-[.toaster]:text-primary",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
