"use client";

import { Component, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@vault/ui";
import { ArrowLeft, RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class MarketDetailErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[MarketDetail] Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-2xl mx-auto py-12 px-4 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="w-8 h-8 text-primary" />
          </div>
          
          <h2 className="text-xl font-semibold mb-3">
            Failed to Load Market
          </h2>
          
          <p className="text-muted-foreground text-sm mb-6">
            We encountered an error loading this market. Please try refreshing the page.
          </p>
          
          {this.state.error && (
            <p className="text-xs text-muted-foreground/60 font-mono mb-6 p-3 bg-muted/50 rounded-lg overflow-auto max-w-full">
              {this.state.error.message}
            </p>
          )}
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Page
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back to Markets
              </Link>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
