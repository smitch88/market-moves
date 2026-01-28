import { Header } from "@/components/layout/header";
import { FAQContent } from "@/components/faq/faq-content";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ | Vault Markets",
  description: "Frequently asked questions about prediction markets, betting, and how Vault Markets works.",
};

export default function FAQPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <FAQContent />
      </main>
    </div>
  );
}
