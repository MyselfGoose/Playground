"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { normalizePartyCode } from "../../../lib/party/buildInviteUrl.js";
import { useLobbyCodeJoin } from "../../../lib/party/useLobbyCodeJoin.js";
import { TabooEntry } from "./TabooEntry.jsx";
import { TabooLobby } from "./TabooLobby.jsx";
import { TabooResult } from "./TabooResult.jsx";
import { tabooPath } from "./taboo-shared.js";
import { TabooErrorBanner } from "./components/TabooErrorBanner.jsx";
import { TabooPage } from "./components/TabooPage.jsx";
import { TabooButton, TabooSpinner } from "./ui/index.js";

const TabooPlay = dynamic(
  () => import("./TabooPlay.jsx").then((m) => ({ default: m.TabooPlay })),
  {
    ssr: false,
    loading: () => (
      <TabooPage stagger={false} className="min-h-[50dvh] items-center justify-center">
        <TabooSpinner label="Loading game…" />
      </TabooPage>
    ),
  },
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

  const normalizeUrlCode = useCallback((raw) => normalizePartyCode(raw).slice(0, 4) || null, []);
  const { urlCode, joinPhase, joinError, retryJoin, hasPendingInviteCode, isJoining } = useLobbyCodeJoin({
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
  }, [view, room?.code, room?.game, room?.game?.status, syncState, pathname, router, hasPendingInviteCode]);

  if (view === "entry") {
    return <TabooEntry />;
  }

  if (view === "lobby" && !room && urlCode) {
    if (isJoining || joinPhase === "idle") {
      return (
        <TabooPage stagger={false} className="min-h-[50dvh] items-center justify-center">
          <TabooSpinner label={`Joining lobby ${urlCode}…`} />
        </TabooPage>
      );
    }
    if (joinPhase === "failed") {
      return (
        <TabooPage stagger={false} className="min-h-[50dvh] items-center justify-center text-center">
          <TabooErrorBanner message={joinError ?? "Could not join room"} className="mb-4" />
          <div className="flex flex-wrap justify-center gap-3">
            <TabooButton variant="primary" onClick={retryJoin}>
              Try again
            </TabooButton>
            <TabooButton variant="ghost" onClick={() => router.replace("/games/taboo")}>
              Back to Taboo
            </TabooButton>
          </div>
        </TabooPage>
      );
    }
  }

  const awaitingSync = syncState !== "ready" && !room;

  if (awaitingSync) {
    return (
      <TabooPage stagger={false} className="min-h-[50dvh] items-center justify-center">
        <TabooSpinner
          label={
            syncState === "error"
              ? "Could not sync your Taboo room. Check your connection."
              : "Syncing your Taboo room…"
          }
        />
      </TabooPage>
    );
  }

  if (!room) {
    if (connectionState === "reconnecting" || connectionState === "connecting") {
      return (
        <TabooPage stagger={false} className="min-h-[50dvh] items-center justify-center">
          <TabooSpinner label="Reconnecting to your Taboo room…" />
        </TabooPage>
      );
    }
    if (connectionState === "disconnected") {
      return (
        <TabooPage stagger={false} className="min-h-[50dvh] items-center justify-center text-center">
          <p className="font-semibold text-taboo-text-muted">
            Connection lost. Use the banner above to retry, or head back to Taboo to rejoin.
          </p>
        </TabooPage>
      );
    }
    return (
      <TabooPage stagger={false} className="min-h-[50dvh] items-center justify-center text-center">
        <p className="font-semibold text-taboo-text-muted">
          No active Taboo room. Head back to Taboo to create or join one.
        </p>
      </TabooPage>
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
