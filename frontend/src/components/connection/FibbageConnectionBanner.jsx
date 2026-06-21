"use client";

import { useRouter } from "next/navigation";
import { useFibbage } from "../../lib/fibbage/FibbageSocketContext.jsx";
import { useConnectionBannerState } from "../../lib/connection/useConnectionBannerState.js";
import { ConnectionBanner } from "./ConnectionBanner.jsx";

export function FibbageConnectionBanner() {
  const router = useRouter();
  const {
    connected,
    connectionState,
    socketError,
    socketErrorCode,
    reconnectedAt,
    retryConnection,
  } = useFibbage();
  const banner = useConnectionBannerState({
    game: "fibbage",
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
      onCreateRoom={() => router.push("/games/fibbage")}
    />
  );
}
