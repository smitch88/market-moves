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
import { XPAnimationProvider } from "@/components/layout/xp-animation";
import { KOLNotificationProvider } from "@/components/kol";
import { DevTools } from "@/components/dev/dev-tools";
import { MobileNav } from "@/components/layout/mobile-nav";
import { WelcomeModal } from "@/components/welcome/welcome-modal";
import { ThemedToaster } from "@/components/providers/themed-toaster";
import { CaptainFloatingPrompt } from "@/components/profile/captain-floating-prompt";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vault777 Markets - Prediction Markets Platform",
    template: "%s | Vault777 Markets",
  },
  description:
    "Trade on real-world outcomes with Vault777 Markets. Bet on sports, politics, crypto, entertainment, and more. Every prediction tracked, every outcome verifiable.",
  keywords: [
    "prediction markets",
    "betting",
    "sports betting",
    "crypto predictions",
    "political betting",
    "entertainment markets",
    "forecast markets",
    "event contracts",
    "Vault777",
  ],
  authors: [{ name: "Vault777" }],
  creator: "Vault777",
  publisher: "Vault777",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://markets.vault777.com"
  ),
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Vault777 Markets",
    title: "Vault777 Markets - Prediction Markets Platform",
    description:
      "Trade on real-world outcomes with Vault777 Markets. Bet on sports, politics, crypto, entertainment, and more. Every prediction tracked, every outcome verifiable.",
    images: [
      {
        url: "/vault777markets.png",
        width: 1200,
        height: 630,
        alt: "Vault777 Markets - Prediction Markets Platform",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vault777 Markets - Prediction Markets Platform",
    description:
      "Trade on real-world outcomes with Vault777 Markets. Bet on sports, politics, crypto, entertainment, and more.",
    images: ["/vault777markets.png"],
    creator: "@vault777",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
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
              <XPAnimationProvider>
                <KOLNotificationProvider>
                  <div className="pb-20 md:pb-0">
                    {children}
                  </div>
                  <MobileNav />
                  <WelcomeModal />
                  <CaptainFloatingPrompt />
                  <DevTools />
                  <ThemedToaster />
                </KOLNotificationProvider>
              </XPAnimationProvider>
            </PrivyProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
