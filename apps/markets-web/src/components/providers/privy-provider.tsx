"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmkvwa8l400fkjj0chn8cvpa8";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  return (
    <BasePrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "twitter", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#dc2626",
          logo: "/logo.svg",
          showWalletLoginFirst: false,
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
        },
        defaultChain: undefined,
      }}
      onSuccess={() => {
        router.refresh();
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
