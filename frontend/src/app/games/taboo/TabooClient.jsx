"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "../../../components/LoadingSkeleton.jsx";
import { Button } from "../../../components/Button.jsx";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { normalizePartyCode } from "../../../lib/party/buildInviteUrl.js";
import { useLobbyCodeJoin } from "../../../lib/party/useLobbyCodeJoin.js";
import { TabooEntry } from "./TabooEntry.jsx";
import { TabooLobby } from "./TabooLobby.jsx";
import { TabooResult } from "./TabooResult.jsx";
import { tabooPath } from "./taboo-shared.js";

const TabooPlay = dynamic(
  () => import("./TabooPlay.jsx").then((m) => ({ default: m.TabooPlay })),
  { ssr: false, loading: () => <LoadingSkeleton variant="playfield" /> },
);

/**
 * @param {{ view: 'entry' | 'lobby' | 'play' | 'result' }} props
 */
export default function TabooClient({ view }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("code") ?? "";
  const { room, connectionState, syncState, connected, joinRoom } = useTaboo();

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

  const code = room?.code ?? roomCode;

  useEffect(() => {
    const awaitingLobbyJoin = view === "lobby" && hasPendingInviteCode;
    const targetRoute = !room?.code
      ? view === "entry" || awaitingLobbyJoin
        ? null
        : "/games/taboo"
      : room.game?.status === "finished"
        ? "/games/taboo/result"
        : room.game
          ? "/games/taboo/play"
          : "/games/taboo/lobby";
    if (!targetRoute) return;
    if (syncState !== "ready" && !room?.code && !awaitingLobbyJoin) return;
    const targetPath = tabooPath(targetRoute, room?.code ?? null);
    if (pathname !== targetRoute) {
      router.replace(targetPath);
    }
  }, [
    view,
    room?.code,
    room?.game,
    room?.game?.status,
    syncState,
    pathname,
    router,
    hasPendingInviteCode,
  ]);

  if (view === "entry") {
    return <TabooEntry />;
  }

  if (view === "lobby" && !room && urlCode) {
    if (isJoining || joinPhase === "idle") {
      return (
        <div className="mx-auto w-full max-w-lg px-4 py-8 text-foreground">
          <LoadingSkeleton variant="playfield" />
          <p className="mt-4 font-semibold text-foreground/70">Joining lobby {urlCode}…</p>
        </div>
      );
    }
    if (joinPhase === "failed") {
      return (
        <div className="mx-auto w-full max-w-lg px-4 py-8 text-center text-foreground">
          <p className="font-semibold text-error">{joinError ?? "Could not join room"}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button variant="primary" onClick={retryJoin}>
              Try again
            </Button>
            <Button variant="secondary" onClick={() => router.replace("/games/taboo")}>
              Back to Taboo
            </Button>
          </div>
        </div>
      );
    }
  }

  const awaitingSync = syncState !== "ready" && !room;

  if (awaitingSync) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8 text-foreground">
        <LoadingSkeleton variant="playfield" />
        <p className="mt-4 font-semibold text-foreground/70">
          {syncState === "error"
            ? "Could not sync your Taboo room. Check your connection and try again."
            : "Syncing your Taboo room…"}
        </p>
      </div>
    );
  }

  if (!room) {
    if (connectionState === "reconnecting" || connectionState === "connecting") {
      return (
        <div className="mx-auto w-full max-w-lg px-4 py-8 text-foreground">
          <p className="font-semibold text-foreground/70">Reconnecting to your Taboo room…</p>
        </div>
      );
    }
    if (connectionState === "disconnected") {
      return (
        <div className="mx-auto w-full max-w-lg px-4 py-8 text-foreground">
          <p className="font-semibold text-foreground/70">
            Connection lost. Use the banner above to retry, or head back to Taboo to rejoin.
          </p>
        </div>
      );
    }
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8 text-foreground">
        <p className="font-semibold text-foreground/70">
          No active Taboo room. Head back to Taboo to create or join one.
        </p>
      </div>
    );
  }

  if (view === "lobby" && !room.game) {
    return <TabooLobby room={room} />;
  }

  const isFinished = room.game?.status === "finished";
  if (view === "result" || isFinished) {
    return <TabooResult room={room} />;
  }

  return <TabooPlay room={room} />;
}
