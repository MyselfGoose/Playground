"use client";

import { useCallback, useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useFibbage } from "../../../lib/fibbage/FibbageSocketContext.jsx";
import { routeTransition } from "../../../lib/fibbage/motion.js";
import { normalizePartyCode } from "../../../lib/party/buildInviteUrl.js";
import { useLobbyCodeJoin } from "../../../lib/party/useLobbyCodeJoin.js";
import { FIBBAGE_PATHS } from "./fibbage-shared.js";
import { FibbageEntry } from "./FibbageEntry.jsx";
import { FibbageLobby } from "./FibbageLobby.jsx";
import { FibbagePlay } from "./FibbagePlay.jsx";
import { FibbageResult } from "./FibbageResult.jsx";
import { FibbageButton } from "./components/FibbageButton.jsx";

/**
 * @param {{ view: 'entry' | 'lobby' | 'play' | 'result' }} props
 */
export default function FibbageClient({ view }) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
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

  const motionProps = routeTransition(reduce);
  const showTransition = !["connecting", "reconnecting"].includes(connectionState);

  if (view === "lobby" && !room && urlCode) {
    if (isJoining || joinPhase === "idle") {
      return (
        <FibbageShell>
          <FibbageLoadingState label={`Joining lobby ${urlCode}…`} />
        </FibbageShell>
      );
    }
    if (joinPhase === "failed") {
      return (
        <FibbageShell>
          <p className="mb-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            {joinError ?? "Could not join room"}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <FibbageButton onClick={retryJoin}>Try again</FibbageButton>
            <FibbageButton
              variant="secondary"
              onClick={() => router.replace(FIBBAGE_PATHS.entry)}
            >
              Back to Fibbage
            </FibbageButton>
          </div>
        </FibbageShell>
      );
    }
  }

  const awaitingSync = syncState !== "ready" && !room;

  if (awaitingSync) {
    return (
      <FibbageShell>
        <FibbageLoadingState
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
    if (view === "entry") {
      return wrapWithRouteTransition(<FibbageEntry />, "entry", showTransition, motionProps);
    }

    if (connectionState === "reconnecting" || connectionState === "connecting") {
      return (
        <FibbageShell>
          <FibbageLoadingState label="Reconnecting to your Fibbage room…" />
        </FibbageShell>
      );
    }
    if (connectionState === "disconnected") {
      return (
        <FibbageShell>
          <p className="mb-4 font-semibold text-[var(--fibbage-text-muted)]">
            Connection lost. Use the banner above to retry, or head back to Fibbage to rejoin.
          </p>
          <FibbageButton onClick={() => router.replace(FIBBAGE_PATHS.entry)}>
            Back to Fibbage
          </FibbageButton>
        </FibbageShell>
      );
    }
    return (
      <FibbageShell>
        <p className="mb-4 font-semibold text-[var(--fibbage-text-muted)]">
          No active Fibbage room. Head back to create or join one.
        </p>
        <FibbageButton onClick={() => router.replace(FIBBAGE_PATHS.entry)}>
          Create or join a room
        </FibbageButton>
      </FibbageShell>
    );
  }

  const content = resolveViewContent({ view, room });

  return wrapWithRouteTransition(content, view, showTransition, motionProps);
}

/**
 * @param {import('react').ReactNode} content
 * @param {string} key
 * @param {boolean} showTransition
 * @param {ReturnType<typeof routeTransition>} motionProps
 */
function wrapWithRouteTransition(content, key, showTransition, motionProps) {
  if (!showTransition) {
    return content;
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div key={key} className="min-h-[100dvh]" {...motionProps}>
        {content}
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * @param {{ view: string, room: NonNullable<ReturnType<typeof useFibbage>['room']> }} args
 */
function resolveViewContent({ view, room }) {
  if (view === "entry") {
    return <FibbageEntry />;
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

function FibbageLoadingState({ label }) {
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4" aria-busy="true" aria-label={label}>
      <div className="fibbage-skeleton h-10 w-48 rounded-xl" />
      <div className="fibbage-skeleton h-32 w-full rounded-2xl" />
      <div className="fibbage-skeleton h-4 w-56 rounded-lg" />
      <p className="text-sm font-semibold text-[var(--fibbage-text-muted)]">{label}</p>
    </div>
  );
}
