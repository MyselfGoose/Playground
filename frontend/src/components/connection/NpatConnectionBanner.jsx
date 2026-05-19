"use client";

import { useRouter } from "next/navigation";
import { useNpat } from "../../lib/npat/NpatSocketContext.jsx";
import { useConnectionBannerState } from "../../lib/connection/useConnectionBannerState.js";
import { ConnectionBanner } from "./ConnectionBanner.jsx";

export function NpatConnectionBanner() {
  const router = useRouter();
  const {
    connected,
    connectionState,
    socketError,
    socketErrorCode,
    reconnectedAt,
    retryConnection,
  } = useNpat();
  const banner = useConnectionBannerState({
    game: "npat",
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
      onCreateRoom={() => router.push("/games/npat")}
    />
  );
}
