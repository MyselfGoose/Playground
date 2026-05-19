"use client";

import { useRouter } from "next/navigation";
import { useTaboo } from "../../lib/taboo/TabooSocketContext.jsx";
import { useConnectionBannerState } from "../../lib/connection/useConnectionBannerState.js";
import { ConnectionBanner } from "./ConnectionBanner.jsx";

export function TabooConnectionBanner() {
  const router = useRouter();
  const {
    connected,
    connectionState,
    socketError,
    socketErrorCode,
    reconnectedAt,
    retryConnection,
  } = useTaboo();
  const banner = useConnectionBannerState({
    game: "taboo",
    connected,
    connectionState,
    socketError,
    socketErrorCode,
    reconnectedAt,
  });

  return (
    <ConnectionBanner
      {...banner}
      onRetry={retryConnection}
      onCreateRoom={() => router.push("/games/taboo")}
    />
  );
}
