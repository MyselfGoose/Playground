"use client";

import { useRouter } from "next/navigation";
import { useTypingRace } from "../../lib/typing-race/TypingRaceSocketContext.jsx";
import { useConnectionBannerState } from "../../lib/connection/useConnectionBannerState.js";
import { ConnectionBanner } from "./ConnectionBanner.jsx";

export function TypingConnectionBanner() {
  const router = useRouter();
  const {
    connected,
    socketLifecycle,
    socketError,
    socketErrorCode,
    reconnectedAt,
    retryConnection,
  } = useTypingRace();
  const banner = useConnectionBannerState({
    game: "typing-race",
    connected,
    socketLifecycle,
    socketError,
    socketErrorCode,
    reconnectedAt,
  });

  return (
    <ConnectionBanner
      {...banner}
      onRetry={retryConnection}
      onCreateRoom={() => router.push("/games/typing-race/multi")}
    />
  );
}
