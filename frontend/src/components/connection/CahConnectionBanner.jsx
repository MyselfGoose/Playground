"use client";

import { useRouter } from "next/navigation";
import { useCah } from "../../lib/cah/CahSocketContext.jsx";
import { useConnectionBannerState } from "../../lib/connection/useConnectionBannerState.js";
import { ConnectionBanner } from "./ConnectionBanner.jsx";

export function CahConnectionBanner() {
  const router = useRouter();
  const {
    connected,
    connectionState,
    socketError,
    socketErrorCode,
    reconnectedAt,
    retryConnection,
  } = useCah();
  const banner = useConnectionBannerState({
    game: "cah",
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
      onCreateRoom={() => router.push("/games/cah")}
    />
  );
}
