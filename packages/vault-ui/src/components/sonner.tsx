"use client"

import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

function Toaster({ theme, ...props }: ToasterProps) {
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        unstyled: false,
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background/95 group-[.toaster]:backdrop-blur-xl group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/50 group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:px-4 group-[.toaster]:py-3",
          title: "group-[.toast]:font-semibold group-[.toast]:text-sm",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:font-medium group-[.toast]:text-xs",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:font-medium group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:bg-background group-[.toast]:border-border/50 group-[.toast]:text-muted-foreground group-[.toast]:hover:bg-muted group-[.toast]:hover:text-foreground",
          error:
            "group-[.toaster]:!bg-red-500/10 group-[.toaster]:!border-red-500/20 group-[.toaster]:!text-red-500 dark:group-[.toaster]:!bg-red-500/10 dark:group-[.toaster]:!border-red-500/30 dark:group-[.toaster]:!text-red-400",
          success:
            "group-[.toaster]:!bg-emerald-500/10 group-[.toaster]:!border-emerald-500/20 group-[.toaster]:!text-emerald-600 dark:group-[.toaster]:!bg-emerald-500/10 dark:group-[.toaster]:!border-emerald-500/30 dark:group-[.toaster]:!text-emerald-400",
          warning:
            "group-[.toaster]:!bg-amber-500/10 group-[.toaster]:!border-amber-500/20 group-[.toaster]:!text-amber-600 dark:group-[.toaster]:!bg-amber-500/10 dark:group-[.toaster]:!border-amber-500/30 dark:group-[.toaster]:!text-amber-400",
          info:
            "group-[.toaster]:!bg-blue-500/10 group-[.toaster]:!border-blue-500/20 group-[.toaster]:!text-blue-600 dark:group-[.toaster]:!bg-blue-500/10 dark:group-[.toaster]:!border-blue-500/30 dark:group-[.toaster]:!text-blue-400",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
