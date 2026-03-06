"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { MiniKit } from "@worldcoin/minikit-js";
import { useEffect } from "react";

function MiniKitInit() {
  useEffect(() => {
    MiniKit.install(process.env.NEXT_PUBLIC_WORLD_APP_ID);
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "clokuv5w200g2l608bj5yvkbu";

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "sms"],
        appearance: { theme: "dark" },
      }}
    >
      <MiniKitInit />
      {children}
    </PrivyProvider>
  );
}
