import { Header } from "@/components/layout/header";
import { FAQContent } from "@/components/faq/faq-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ | Vault Markets",
  description: "Frequently asked questions about prediction markets, betting, and how Vault Markets works.",
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      <main className="container mx-auto px-4 py-8">
        <FAQContent />
      </main>
    </div>
  );
}
