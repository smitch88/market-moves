"use client";

import { PrivyProvider as BasePrivyProvider } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "cmkvwa8l400fkjj0chn8cvpa8";

export function PrivyProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <BasePrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["twitter"],
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
        // Invalidate auth-dependent queries after successful login
        // Small delay to ensure the access token is ready
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["profile"] });
          queryClient.invalidateQueries({ queryKey: ["xp"] });
        }, 100);
        router.refresh();
      }}
    >
      {children}
    </BasePrivyProvider>
  );
}
