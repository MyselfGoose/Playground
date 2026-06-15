"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoadingSkeleton } from "../../../components/LoadingSkeleton.jsx";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
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
  const { room, connectionState, syncState } = useTaboo();

  const code = room?.code ?? roomCode;

  useEffect(() => {
    const targetRoute = !room?.code
      ? view === "entry"
        ? null
        : "/games/taboo"
      : room.game?.status === "finished"
        ? "/games/taboo/result"
        : room.game
          ? "/games/taboo/play"
          : "/games/taboo/lobby";
    if (!targetRoute || syncState !== "ready") return;
    const targetPath = tabooPath(targetRoute, room?.code ?? null);
    if (pathname !== targetRoute) {
      router.replace(targetPath);
    }
  }, [view, room?.code, room?.game, room?.game?.status, syncState, pathname, router]);

  if (view === "entry") {
    return <TabooEntry />;
  }

  if (syncState !== "ready") {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8 text-foreground">
        <LoadingSkeleton variant="playfield" />
        <p className="mt-4 font-semibold text-foreground/70">Syncing your Taboo room…</p>
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
