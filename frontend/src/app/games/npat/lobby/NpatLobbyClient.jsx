"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useNpat } from "../../../../lib/npat/NpatSocketContext.jsx";
import { Button } from "../../../../components/Button.jsx";
import { LobbyPanel } from "../../../../components/LobbyPanel.jsx";
import { Avatar } from "../../../../components/Avatar.jsx";
import { formatJoinCodeForServer, getNpatRoomCodeLength } from "../../../../lib/npat/roomCode.js";

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

  const [copied, setCopied] = useState(false);
  const [joinPhase, setJoinPhase] = useState(/** @type {JoinPhase} */ ("idle"));
  const [joinError, setJoinError] = useState(/** @type {string | null} */ (null));
  const [actionError, setActionError] = useState(/** @type {string | null} */ (null));
  const [starting, setStarting] = useState(false);
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
        setJoinError(result.error?.message ?? "Could not join room");
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

  const copyCode = useCallback(() => {
    if (!room?.code) return;
    void navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [room]);

  const isHost = localUserId && room?.hostUserId === localUserId;
  const players = Array.isArray(room?.players) ? room.players : [];
  const roomSynced = joinPhase === "ready" && normalizedCode && room?.code === normalizedCode;

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
        <p className="text-sm font-bold">Connecting to game server…</p>
        <Link href="/games/npat" className="mt-8 text-sm font-bold text-primary underline">
          ← Back
        </Link>
      </div>
    );
  }

  if (joinPhase === "failed") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-semibold text-foreground">Could not join this room.</p>
        {joinError ? <p className="mt-3 text-sm text-error">{joinError}</p> : null}
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

  const blocking =
    joinPhase === "idle" || joinPhase === "joining" || (joinPhase === "ready" && !roomSynced);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/games/npat" className="text-sm font-bold text-primary underline-offset-2 hover:underline transition-colors">
          ← Back
        </Link>
        <button
          type="button"
          className="text-sm font-bold text-muted underline-offset-2 hover:text-primary hover:underline transition-colors"
          onClick={async () => {
            await leaveRoom();
            router.push("/games/npat");
          }}
        >
          Leave room
        </button>
      </div>

      {socketError && joinPhase === "ready" ? (
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-2xl)] border-2 border-error/20 bg-error/5 px-4 py-3 text-center text-sm font-semibold text-error"
        >
          {socketError}
          <button type="button" className="ml-3 font-bold underline" onClick={() => clearSocketError()}>
            Dismiss
          </button>
        </motion.p>
      ) : null}

      {actionError ? (
        <motion.p 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-2xl)] border-2 border-error/20 bg-error/5 px-4 py-2 text-center text-sm font-semibold text-error"
        >
          {actionError}
          <button
            type="button"
            className="ml-3 font-bold underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </motion.p>
      ) : null}

      {blocking ? (
        <p className="text-center text-sm font-bold text-muted">Joining room…</p>
      ) : null}

      <LobbyPanel>
        <p className="text-center text-xs font-extrabold uppercase tracking-widest text-muted mb-4">Room Code</p>
        <div className="flex flex-col items-center gap-6">
          <motion.span 
            className="text-6xl sm:text-7xl font-black tracking-[0.1em] text-transparent bg-gradient-to-r from-primary via-accent-pink to-accent-purple bg-clip-text font-mono tabular-nums"
            animate={roomSynced ? { scale: [1, 1.02, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
          >
            {roomSynced && room?.code ? room.code : "—"}
          </motion.span>
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Button 
              type="button" 
              variant={copied ? "secondary" : "primary"}
              className="px-6 py-3 font-extrabold" 
              onClick={copyCode} 
              disabled={!roomSynced}
            >
              {copied ? "✓ Copied!" : "📋 Copy Code"}
            </Button>
          </motion.div>
        </div>
        <p className="mt-6 text-center text-sm text-foreground/70">
          Mode: <span className="font-bold text-primary">{roomSynced ? room?.mode ?? "…" : "…"}</span>
        </p>
      </LobbyPanel>

      <LobbyPanel title={`🎮 Players (${players.length})`}>
        {roomSynced ? (
          <ul className="flex flex-col gap-3">
            {players.map((p) => (
              <motion.li
                key={p.userId}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-[var(--radius-xl)] bg-gradient-to-r from-muted-bright/20 to-transparent p-4 ring-1 ring-muted-bright/40"
              >
                <div className="flex items-center gap-3">
                  <Avatar username={p.username} size="sm" />
                  <div>
                    <div className="font-bold text-foreground flex items-center gap-2">
                      {p.username}
                      {p.userId === room?.hostUserId ? (
                        <span className="text-xs font-extrabold uppercase px-2 py-1 bg-accent-lemon text-foreground rounded-full">👑 Host</span>
                      ) : null}
                      {!p.connected ? (
                        <span className="text-xs font-bold text-muted">📴 Offline</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {room?.mode === "team" ? (
                    <select
                      className="rounded-full border-2 border-muted-bright/40 bg-background px-3 py-2 text-sm font-bold text-foreground transition-all hover:border-primary"
                      value={p.teamId ?? ""}
                      disabled={p.userId !== localUserId || room?.state !== "WAITING"}
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
                  ) : null}
                  {p.userId === localUserId ? (
                    <Button
                      type="button"
                      variant={p.ready ? "secondary" : "primary"}
                      className="px-4 py-2 text-sm font-extrabold whitespace-nowrap"
                      title={
                        p.ready
                          ? "Click to mark yourself as not ready"
                          : "Mark yourself ready for the host to start"
                      }
                      disabled={room?.state !== "WAITING"}
                      onClick={async () => {
                        setActionError(null);
                        const r = await setReady(!p.ready);
                        if (!r.ok) setActionError(r.error?.message ?? "Could not update ready state");
                      }}
                    >
                      {p.ready ? "✓ Ready" : "Get Ready"}
                    </Button>
                  ) : (
                    <span className={`text-sm font-bold px-3 py-2 rounded-full ${p.ready ? "bg-success/20 text-success" : "bg-muted-bright/20 text-muted"}`}>
                      {p.ready ? "✓ Ready" : "Waiting"}
                    </span>
                  )}
                </div>
              </motion.li>
            ))}
            {players.length === 0 ? (
              <li className="text-center text-muted py-8">No players yet. Share the code to invite friends!</li>
            ) : null}
          </ul>
        ) : (
          <p className="mt-4 text-muted">Waiting for server…</p>
        )}
      </LobbyPanel>

      {roomSynced && isHost ? (
        <motion.div 
          className="flex justify-center pt-4"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button
            type="button"
            variant="primary"
            className="px-8 py-4 text-lg font-extrabold"
            disabled={!connected || room?.state !== "WAITING" || starting}
            onClick={async () => {
              setActionError(null);
              clearSocketError();
              setStarting(true);
              const r = await startGame();
              setStarting(false);
              if (!r.ok) {
                setActionError(r.error?.message ?? "Could not start game");
              }
            }}
          >
            {starting ? "🚀 Starting…" : "🎬 Start Game"}
          </Button>
        </motion.div>
      ) : roomSynced ? (
        <p className="text-center text-sm font-bold text-muted py-6">⏱️ Waiting for host to start…</p>
      ) : null}
    </div>
  );
}
