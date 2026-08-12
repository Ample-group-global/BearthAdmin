"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { sepolia, baseSepolia, polygon, mainnet } from "viem/chains";
import { ChainProvider } from "@/lib/ChainContext";
import { useBackendSession } from "@/lib/useBackendSession";
const queryClient = new QueryClient();
function BackendSessionSync() {
  useBackendSession();
  return null;
}
if (typeof window !== "undefined") {
  const origError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("unique \"key\" prop")) return;
    if (typeof args[0] === "string" && args[0].startsWith("ERROR:") && args[1] != null && typeof args[1] === "object" && Object.keys(args[1]).length === 0) return;
    if (typeof args[0] === "string" && args[0].includes("Cross-Origin-Opener-Policy")) return;
    origError.apply(console, args as any[]);
  };
}

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    return <QueryClientProvider client={queryClient}><ChainProvider>{children}</ChainProvider></QueryClientProvider>;
  }
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#6366f1",
        },
        loginMethods: ["wallet", "email"],
        defaultChain: polygon,
        supportedChains: [polygon, baseSepolia, sepolia, mainnet],
      }}
    >
      <QueryClientProvider client={queryClient}>
        <ChainProvider>
          <BackendSessionSync />
          {children}
        </ChainProvider>
      </QueryClientProvider>
    </PrivyProvider>
  );
}
