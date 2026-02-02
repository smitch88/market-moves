import Link from "next/link";
import Image from "next/image";
import { Button } from "@vault/ui";
import { ArrowLeft, TrendingUp } from "lucide-react";

export default function NotFound() {
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

      {/* 404 Display */}
      <div className="relative mb-6">
        <h1 className="text-[120px] sm:text-[180px] font-bold text-primary/10 leading-none select-none">
          404
        </h1>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-4xl sm:text-6xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            404
          </span>
        </div>
      </div>

      {/* Message */}
      <div className="text-center max-w-md mx-auto mb-8">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground mb-3">
          Market Not Found
        </h2>
        <p className="text-muted-foreground text-sm sm:text-base">
          Looks like this page doesn&apos;t exist or has been moved. 
          Don&apos;t worry, there are plenty of markets waiting for your predictions.
        </p>
      </div>

      {/* CTA Button */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild size="lg" className="gap-2">
          <Link href="/">
            <TrendingUp className="h-4 w-4" />
            Explore Markets
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg" className="gap-2">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Go Home
          </Link>
        </Button>
      </div>

      {/* Decorative elements */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
    </div>
  );
}
