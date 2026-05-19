"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHangman } from "../../../../lib/hangman/HangmanSocketContext.jsx";

/**
 * Derived multiplayer room state + route sync.
 */
export function useHangmanRoom(view) {
  const router = useRouter();
  const pathname = usePathname();
  const { room, syncState, localUserId, connected, connectionState, socketError, reconnectedAt, roomNotice, clearRoomNotice } =
    useHangman();

  const game = room?.game ?? null;
  const phase = game?.phase ?? null;
  const inLobby = !game;
  const countdownActive =
    inLobby && Boolean(room?.lobby?.countdownEndsAt) && (room?.lobby?.countdownSecondsRemaining ?? 0) > 0;

  const scoreRows = useMemo(() => {
    const entries = Object.entries(game?.scores ?? {}).sort((a, b) => b[1] - a[1]);
    return entries.map(([uid, score]) => ({
      uid,
      score,
      name: room?.players?.find((p) => p.userId === uid)?.username ?? uid,
    }));
  }, [game?.scores, room?.players]);

  const activePlayer = useMemo(() => {
    const turnId = game?.currentTurnUserId;
    if (!turnId) return null;
    return room?.players?.find((p) => p.userId === turnId) ?? null;
  }, [game?.currentTurnUserId, room?.players]);

  const readyCount = useMemo(
    () => (room?.players ?? []).filter((p) => p.ready && p.connected !== false).length,
    [room?.players],
  );

  const connectedCount = useMemo(
    () => (room?.players ?? []).filter((p) => p.connected !== false).length,
    [room?.players],
  );

  useEffect(() => {
    if (syncState === "ready" && !room?.code && view !== "entry") {
      router.replace("/games/hangman");
    }
  }, [syncState, room?.code, view, router]);

  useEffect(() => {
    if (syncState !== "ready") return;
    const targetRoute = !room?.code
      ? view === "entry"
        ? null
        : "/games/hangman"
      : phase === "game_end"
        ? "/games/hangman/play"
        : inLobby
          ? "/games/hangman/lobby"
          : "/games/hangman/play";
    if (!targetRoute || pathname === targetRoute) return;
    router.replace(targetRoute);
  }, [view, room?.code, phase, inLobby, syncState, pathname, router]);

  return {
    room,
    game,
    phase,
    inLobby,
    countdownActive,
    countdownSeconds: room?.lobby?.countdownSecondsRemaining ?? 0,
    permissions: room?.permissions ?? {},
    scoreRows,
    activePlayer,
    readyCount,
    connectedCount,
    localUserId,
    connected,
    connectionState,
    socketError,
    syncState,
    isSyncing: syncState !== "ready",
    reconnectedAt,
    roomNotice,
    clearRoomNotice,
    lastScores: room?.lobby?.lastScores ?? null,
  };
}
