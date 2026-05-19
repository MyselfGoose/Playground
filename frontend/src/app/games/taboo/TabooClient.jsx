"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTaboo } from "../../../lib/taboo/TabooSocketContext.jsx";
import { TabooEntry } from "./TabooEntry.jsx";
import { TabooLobby } from "./TabooLobby.jsx";
import { TabooPlay } from "./TabooPlay.jsx";
import { TabooResult } from "./TabooResult.jsx";
import { tabooPath } from "./taboo-shared.js";

/**
 * @param {{ view: 'entry' | 'lobby' | 'play' | 'result' }} props
 */
export default function TabooClient({ view }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roomCode = searchParams.get("code") ?? "";
  const { room, connectionState } = useTaboo();

  const code = room?.code ?? roomCode;

  useEffect(() => {
    if (view === "entry" && room?.code) {
      router.replace(tabooPath("/games/taboo/lobby", room.code));
    }
  }, [view, room?.code, router]);

  useEffect(() => {
    if (!room?.game) return;
    if (view === "lobby") {
      router.replace(tabooPath("/games/taboo/play", code));
    }
    if (room.game.status === "finished" && view === "play") {
      router.replace(tabooPath("/games/taboo/result", code));
    }
  }, [view, room?.game, room?.game?.status, code, router]);

  if (view === "entry") {
    return <TabooEntry />;
  }

  if (!room) {
    if (connectionState === "reconnecting" || connectionState === "disconnected") {
      return (
        <div className="mx-auto w-full max-w-lg px-4 py-8 text-foreground">
          <p className="font-semibold text-foreground/70">Reconnecting to your Taboo room…</p>
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
