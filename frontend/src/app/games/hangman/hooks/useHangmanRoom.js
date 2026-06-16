"use client";

import { useMemo, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useHangman } from "../../../../lib/hangman/HangmanSocketContext.jsx";
import { normalizePartyCode } from "../../../../lib/party/buildInviteUrl.js";
import { useLobbyCodeJoin } from "../../../../lib/party/useLobbyCodeJoin.js";

/**
 * Derived multiplayer room state + route sync.
 */
export function useHangmanRoom(view) {
  const router = useRouter();
  const pathname = usePathname();
  const { room, syncState, localUserId, connected, connectionState, socketError, reconnectedAt, roomNotice, clearRoomNotice, joinRoom } =
    useHangman();

  const normalizeUrlCode = useCallback(
    (raw) => normalizePartyCode(raw).slice(0, 4) || null,
    [],
  );
  const lobbyJoin = useLobbyCodeJoin({
    connected,
    currentRoomCode: room?.code ?? null,
    joinRoom,
    normalizeUrlCode,
  });

  const game = room?.game ?? null;
  const phase = game?.phase ?? null;
  const inLobby = !game;
  const countdownActive =
    inLobby && Boolean(room?.lobby?.countdownEndsAt) && (room?.lobby?.countdownSecondsRemaining ?? 0) > 0;

  const scoreRows = useMemo(() => {
    const entries = Object.entries(game?.scores ?? {}).sort((a, b) => b[1] - a[1]);
    return entries.map(([uid, score]) => {
      const pl = room?.players?.find((p) => p.userId === uid);
      return {
        uid,
        score,
        name: pl?.username ?? uid,
        presenceStatus: pl?.presenceStatus,
        graceEndsAtMs: pl?.graceEndsAtMs,
        graceSecondsRemaining: pl?.graceSecondsRemaining,
        connected: pl?.connected,
      };
    });
  }, [game?.scores, room?.players]);

  const activePlayer = useMemo(() => {
    const turnId = game?.currentTurnUserId;
    if (!turnId) return null;
    return room?.players?.find((p) => p.userId === turnId) ?? null;
  }, [game?.currentTurnUserId, room?.players]);

  const readyCount = useMemo(
    () =>
      (room?.players ?? []).filter(
        (p) => p.ready && p.presenceStatus !== "gone" && p.connected !== false,
      ).length,
    [room?.players],
  );

  const connectedCount = useMemo(
    () =>
      (room?.players ?? []).filter(
        (p) =>
          p.presenceStatus === "connected" ||
          p.presenceStatus === "disconnect_pending" ||
          (p.presenceStatus == null && p.connected !== false),
      ).length,
    [room?.players],
  );

  useEffect(() => {
    if (syncState === "ready" && !room?.code && view !== "entry") {
      if (view === "lobby" && lobbyJoin.urlCode) return;
      router.replace("/games/hangman");
    }
  }, [syncState, room?.code, view, router, lobbyJoin.urlCode]);

  useEffect(() => {
    if (syncState !== "ready" && !room?.code && !lobbyJoin.hasPendingInviteCode) return;
    const awaitingLobbyJoin = view === "lobby" && lobbyJoin.hasPendingInviteCode;
    const targetRoute = !room?.code
      ? view === "entry" || awaitingLobbyJoin
        ? null
        : "/games/hangman"
      : phase === "game_end"
        ? "/games/hangman/play"
        : inLobby
          ? "/games/hangman/lobby"
          : "/games/hangman/play";
    if (!targetRoute || pathname === targetRoute) return;
    router.replace(targetRoute);
  }, [view, room?.code, phase, inLobby, syncState, pathname, router, lobbyJoin.hasPendingInviteCode]);

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
    lobbyJoin,
  };
}
