"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";
import { normalizePartyCode } from "../../../lib/party/buildInviteUrl.js";
import { useLobbyCodeJoin } from "../../../lib/party/useLobbyCodeJoin.js";
import { FIBBAGE_PATHS } from "./fibbage-shared.js";
import { FibbageEntry } from "./FibbageEntry.jsx";
import { FibbageLobby } from "./FibbageLobby.jsx";
import { FibbagePlay } from "./FibbagePlay.jsx";
import { FibbageResult } from "./FibbageResult.jsx";

/**
 * @param {{ view: 'entry' | 'lobby' | 'play' | 'result' }} props
 */
export default function FibbageClient({ view }) {
  const router = useRouter();
  const pathname = usePathname();
  const { room, connectionState, syncState, connected, joinRoom } = useFibbage();

  const normalizeUrlCode = useCallback(
    (raw) => normalizePartyCode(raw).slice(0, 4) || null,
    [],
  );

  const { urlCode, joinPhase, joinError, retryJoin, hasPendingInviteCode, isJoining } =
    useLobbyCodeJoin({
      connected,
      currentRoomCode: room?.code ?? null,
      joinRoom,
      normalizeUrlCode,
    });

  useEffect(() => {
    const awaitingLobbyJoin = view === "lobby" && hasPendingInviteCode;
    const targetRoute = !room?.code
      ? view === "entry" || awaitingLobbyJoin
        ? null
        : FIBBAGE_PATHS.entry
      : room.game?.status === "finished"
        ? FIBBAGE_PATHS.result
        : room.game
          ? FIBBAGE_PATHS.play
          : FIBBAGE_PATHS.lobby;

    if (!targetRoute) return;
    if (syncState !== "ready" && !room?.code && !awaitingLobbyJoin) return;
    if (pathname !== targetRoute) {
      router.replace(targetRoute);
    }
  }, [view, room?.code, room?.game, room?.game?.status, syncState, pathname, router, hasPendingInviteCode]);

  if (view === "entry") {
    return <FibbageEntry />;
  }

  if (view === "lobby" && !room && urlCode) {
    if (isJoining || joinPhase === "idle") {
      return (
        <FibbageShell>
          <FibbageSpinner label={`Joining lobby ${urlCode}…`} />
        </FibbageShell>
      );
    }
    if (joinPhase === "failed") {
      return (
        <FibbageShell>
          <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400">
            {joinError ?? "Could not join room"}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button className="fibbage-btn" onClick={retryJoin}>
              Try again
            </button>
            <button
              className="fibbage-btn fibbage-btn--secondary"
              onClick={() => router.replace(FIBBAGE_PATHS.entry)}
            >
              Back to Fibbage
            </button>
          </div>
        </FibbageShell>
      );
    }
  }

  const awaitingSync = syncState !== "ready" && !room;

  if (awaitingSync) {
    return (
      <FibbageShell>
        <FibbageSpinner
          label={
            syncState === "error"
              ? "Could not sync your Fibbage room. Check your connection."
              : "Syncing your Fibbage room…"
          }
        />
      </FibbageShell>
    );
  }

  if (!room) {
    if (connectionState === "reconnecting" || connectionState === "connecting") {
      return (
        <FibbageShell>
          <FibbageSpinner label="Reconnecting to your Fibbage room…" />
        </FibbageShell>
      );
    }
    if (connectionState === "disconnected") {
      return (
        <FibbageShell>
          <p className="font-semibold text-[var(--fibbage-text-muted)]">
            Connection lost. Use the banner above to retry, or head back to Fibbage to rejoin.
          </p>
        </FibbageShell>
      );
    }
    return (
      <FibbageShell>
        <p className="font-semibold text-[var(--fibbage-text-muted)]">
          No active Fibbage room. Head back to create or join one.
        </p>
      </FibbageShell>
    );
  }

  if (view === "lobby" && !room.game) {
    return <FibbageLobby />;
  }

  const isFinished = room.game?.status === "finished";
  if (view === "result" || isFinished) {
    return <FibbageResult />;
  }

  return <FibbagePlay />;
}

function FibbageShell({ children }) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center px-4 text-center">
      {children}
    </div>
  );
}

function FibbageSpinner({ label }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--fibbage-accent)] border-t-transparent" />
      <p className="text-sm font-semibold text-[var(--fibbage-text-muted)]">{label}</p>
    </div>
  );
}
