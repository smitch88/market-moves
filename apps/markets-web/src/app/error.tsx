"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@vault/ui";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <Link href="/" className="mb-8">
        <Image
          src="/logo.svg"
          alt="Vault Markets"
          width={48}
          height={48}
          className="h-12 w-12"
        />
      </Link>

      {/* Error Icon */}
      <div className="relative mb-6">
        <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-primary/10 flex items-center justify-center">
          <AlertTriangle className="w-12 h-12 sm:w-16 sm:h-16 text-primary" />
        </div>
        <div className="absolute -inset-4 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Message */}
      <div className="text-center max-w-md mx-auto mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">
          Something Went Wrong
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base mb-4">
          We encountered an unexpected error. Don&apos;t worry, your predictions are safe. 
          Try refreshing the page or head back to the markets.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={reset} size="lg" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Button asChild variant="outline" size="lg" className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back to Markets
          </Link>
        </Button>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
