"use client";

import { useRouter } from "next/navigation";
import { useHangman } from "../../lib/hangman/HangmanSocketContext.jsx";
import { useConnectionBannerState } from "../../lib/connection/useConnectionBannerState.js";
import { ConnectionBanner } from "./ConnectionBanner.jsx";

export function HangmanConnectionBanner() {
  const router = useRouter();
  const {
    connected,
    connectionState,
    socketError,
    socketErrorCode,
    reconnectedAt,
    retryConnection,
  } = useHangman();
  const banner = useConnectionBannerState({
    game: "hangman",
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
      onCreateRoom={() => router.push("/games/hangman")}
    />
  );
}
