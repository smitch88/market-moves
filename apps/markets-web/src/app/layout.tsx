import type { Metadata } from "next";
import { Montserrat, JetBrains_Mono } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
});
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PrivyProvider } from "@/components/providers/privy-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { DevTools } from "@/components/dev/dev-tools";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Toaster } from "@vault/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vault Markets | Prediction Markets",
  description: "The future of decentralized prediction markets. Place bets on real-world outcomes.",
  openGraph: {
    title: "Vault Markets | Prediction Markets",
    description: "The future of decentralized prediction markets.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className={`${montserrat.variable} ${jetbrainsMono.variable} font-sans antialiased min-h-screen bg-background grid-bg`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <PrivyProvider>
              <div className="pb-20 md:pb-0">
                {children}
              </div>
              <MobileNav />
              <DevTools />
              <Toaster position="top-right" richColors closeButton />
            </PrivyProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
