"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useNpat } from "../../../../lib/npat/NpatSocketContext.jsx";
import { PartyLobby } from "../../../../components/party/PartyLobby.jsx";
import { formatJoinCodeForServer, getNpatRoomCodeLength } from "../../../../lib/npat/roomCode.js";
import { formatNpatMode, isNpatTeamMode } from "../../../../lib/npat/modeLabels.js";
import { useConnectionTimeout } from "../../../../lib/socket/useConnectionTimeout.js";
import {
  mapConnectionError,
  mapConnectionErrorMessage,
} from "../../../../lib/errors/mapConnectionError.js";
import { ErrorState } from "../../../../components/feedback/ErrorState.jsx";

/** @typedef {'idle' | 'joining' | 'ready' | 'failed'} JoinPhase */

export function NpatLobbyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const {
    room,
    connected,
    joinRoom,
    leaveRoom,
    setReady,
    switchTeam,
    startGame,
    socketError,
    clearSocketError,
    localUserId,
  } = useNpat();

  const [joinPhase, setJoinPhase] = useState(/** @type {JoinPhase} */ ("idle"));
  const connectTimedOut = useConnectionTimeout(connected);
  const [joinError, setJoinError] = useState(
    /** @type {import("../../../../lib/errors/mapConnectionError.js").ConnectionErrorResult | null} */ (null),
  );
  const [actionError, setActionError] = useState(/** @type {string | null} */ (null));
  const [starting, setStarting] = useState(false);
  const [readyPending, setReadyPending] = useState(false);
  const [joinRetryToken, setJoinRetryToken] = useState(0);

  const codeLen = useMemo(() => getNpatRoomCodeLength(), []);

  const normalizedCode = useMemo(() => {
    try {
      return formatJoinCodeForServer(code);
    } catch {
      return null;
    }
  }, [code]);

  useEffect(() => {
    if (!code.trim() || normalizedCode === null || !connected) {
      return;
    }

    let cancelled = false;

    void (async () => {
      setJoinPhase("joining");
      setJoinError(null);
      clearSocketError();
      const result = await joinRoom(code);
      if (cancelled) return;
      if (result.ok) {
        setJoinPhase("ready");
      } else {
        setJoinPhase("failed");
        setJoinError(mapConnectionError("npat", result.error));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, normalizedCode, connected, joinRoom, clearSocketError, joinRetryToken]);

  useEffect(() => {
    const st = room?.state;
    if (joinPhase !== "ready" || !normalizedCode || room?.code !== normalizedCode) {
      return;
    }
    if (!st || st === "WAITING") return;
    if (st === "FINISHED") {
      router.replace(`/games/npat/result?code=${room.code}`);
      return;
    }
    router.replace(`/games/npat/play?code=${room.code}`);
  }, [joinPhase, room?.state, room?.code, normalizedCode, router]);

  const isHost = Boolean(localUserId && room?.hostUserId === localUserId);
  const players = Array.isArray(room?.players) ? room.players : [];
  const roomSynced = joinPhase === "ready" && normalizedCode && room?.code === normalizedCode;
  const isTeam = isNpatTeamMode(room?.mode);
  const minPlayers = 2;

  const connectedPlayers = useMemo(
    () => players.filter((p) => p?.connected !== false),
    [players],
  );
  const connectedCount = connectedPlayers.length;
  const readyCount = connectedPlayers.filter((p) => p?.ready).length;

  const me = useMemo(
    () => players.find((p) => p.userId === localUserId) ?? null,
    [players, localUserId],
  );

  const partyPlayers = useMemo(
    () =>
      players.map((p) => ({
        id: p.userId,
        name: p.username ?? "Player",
        ready: Boolean(p.ready),
        connected: p.connected !== false,
        isHost: p.userId === room?.hostUserId,
        team: isTeam && p.teamId ? (room?.teams ?? []).find((t) => t.id === p.teamId)?.name : undefined,
      })),
    [players, room?.hostUserId, room?.teams, isTeam],
  );

  const teamNeedMore = useMemo(() => {
    if (!isTeam || !roomSynced) return false;
    const teamIds = (room?.teams ?? []).map((t) => t.id);
    return teamIds.some((tid) => !connectedPlayers.some((p) => p.teamId === tid));
  }, [isTeam, roomSynced, room?.teams, connectedPlayers]);

  const needMore = connectedCount < minPlayers || teamNeedMore;

  const statusLine = needMore
    ? isTeam
      ? "Each team needs at least one connected player"
      : `Need at least ${minPlayers} connected players`
    : `${readyCount} of ${connectedCount} ready`;

  const startRules = needMore
    ? "Share the room code or invite link so friends can join."
    : isHost
      ? "When everyone is ready, start the game."
      : "Waiting for the host to start when everyone is ready.";

  const handleLeave = useCallback(async () => {
    await leaveRoom();
    router.push("/games/npat");
  }, [leaveRoom, router]);

  if (!code) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="text-muted">Missing room code.</p>
        <Link href="/games/npat" className="mt-4 inline-block font-bold text-primary underline">
          Back
        </Link>
      </div>
    );
  }

  if (normalizedCode === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-semibold text-foreground">That room code is not valid.</p>
        <p className="mt-2 text-sm text-muted">Use a numeric code with exactly {codeLen} digits.</p>
        <Link href="/games/npat" className="mt-6 inline-block font-bold text-primary underline">
          Back to NPAT
        </Link>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center text-muted">
        {socketError || connectTimedOut ? (
          <p className="rounded-[var(--radius-2xl)] border-2 border-error/20 bg-error/5 px-4 py-3 text-sm font-semibold text-error">
            {socketError || mapConnectionErrorMessage("npat", null, { phase: "timeout" })}
          </p>
        ) : null}
        <Link href="/games/npat" className="mt-8 text-sm font-bold text-primary underline">
          ← Back
        </Link>
      </div>
    );
  }

  if (joinPhase === "failed") {
    if (joinError && (joinError.code === "ROOM_NOT_FOUND" || joinError.code === "ROOM_EXPIRED")) {
      return (
        <ErrorState
          title={joinError.code === "ROOM_EXPIRED" ? "Room expired" : "Room not found"}
          message={joinError.message}
          actions={[
            { label: "Create new game", href: "/games/npat" },
            { label: "Back to games", href: "/games" },
          ]}
        />
      );
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-semibold text-foreground">Could not join this room.</p>
        {joinError ? <p className="mt-3 text-sm text-error">{joinError.message}</p> : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/games/npat"
            className="rounded-full bg-primary px-6 py-3 text-sm font-extrabold text-white shadow-[var(--shadow-play)]"
          >
            Back to NPAT
          </Link>
          <button
            type="button"
            className="rounded-full px-6 py-3 text-sm font-extrabold text-foreground ring-2 ring-muted-bright"
            onClick={() => {
              setJoinError(null);
              setJoinRetryToken((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const blocking = joinPhase === "idle" || joinPhase === "joining" || (joinPhase === "ready" && !roomSynced);

  if (blocking) {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center text-muted">
        <p className="text-sm font-bold">Joining room…</p>
        <Link href="/games/npat" className="mt-8 text-sm font-bold text-primary underline">
          ← Back
        </Link>
      </div>
    );
  }

  const lobbyError = actionError || (joinPhase === "ready" ? socketError : null);

  const settingsPanel = isTeam ? (
    <div className="rounded-2xl border border-foreground/10 bg-background/90 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-foreground/50">Your team</p>
      <select
        className="mt-2 w-full rounded-xl border-2 border-muted-bright/40 bg-background px-3 py-2 text-sm font-bold text-foreground"
        value={me?.teamId ?? ""}
        disabled={!me || room?.state !== "WAITING"}
        onChange={async (e) => {
          setActionError(null);
          const r = await switchTeam(e.target.value);
          if (!r.ok) setActionError(r.error?.message ?? "Could not switch team");
        }}
      >
        {(room?.teams ?? []).map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </div>
  ) : null;

  const allReady = !needMore && connectedCount > 0 && readyCount === connectedCount;

  return (
    <PartyLobby
      gameSlug="npat"
      code={room?.code ?? normalizedCode}
      players={partyPlayers}
      localUserId={localUserId}
      startPolicy="host"
      startRules={startRules}
      statusLine={`${formatNpatMode(room?.mode)} · ${statusLine}`}
      minPlayers={minPlayers}
      connectedCount={connectedCount}
      readyCount={readyCount}
      header={{
        gameId: "npat",
        eyebrow: "Lobby",
        title: "Waiting to start",
        description: "Share your code so friends can join.",
        align: "left",
      }}
      settings={settingsPanel}
      ready={Boolean(me?.ready)}
      readyDisabled={room?.state !== "WAITING" || !me}
      readyPending={readyPending}
      onReadyToggle={async () => {
        if (!me) return;
        setActionError(null);
        setReadyPending(true);
        const r = await setReady(!me.ready);
        setReadyPending(false);
        if (!r.ok) setActionError(r.error?.message ?? "Could not update ready state");
      }}
      canStart={isHost && allReady && room?.state === "WAITING"}
      onStart={async () => {
        setActionError(null);
        clearSocketError();
        setStarting(true);
        const r = await startGame();
        setStarting(false);
        if (!r.ok) setActionError(r.error?.message ?? "Could not start game");
      }}
      startPending={starting}
      onLeave={() => void handleLeave()}
      error={lobbyError}
      footer={
        <p className="text-center text-sm text-foreground/60">
          <Link href="/games/npat" className="font-bold text-primary underline-offset-2 hover:underline">
            ← Back to entry
          </Link>
        </p>
      }
      className="max-w-3xl"
    />
  );
}
