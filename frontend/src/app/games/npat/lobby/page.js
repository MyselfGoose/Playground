"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useNpat } from "../../../../lib/npat/NpatSocketContext.jsx";
import { Button } from "../../../../components/Button.jsx";
import { formatJoinCodeForServer, getNpatRoomCodeLength } from "../../../../lib/npat/roomCode.js";

/** @typedef {'idle' | 'joining' | 'ready' | 'failed'} JoinPhase */

function NpatLobbyInner() {
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
        <p className="text-ink-muted">Missing room code.</p>
        <Link href="/games/npat" className="mt-4 inline-block font-bold text-accent underline">
          Back
        </Link>
      </div>
    );
  }

  if (normalizedCode === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-semibold text-ink">That room code is not valid.</p>
        <p className="mt-2 text-sm text-ink-muted">Use a numeric code with exactly {codeLen} digits.</p>
        <Link href="/games/npat" className="mt-6 inline-block font-bold text-accent underline">
          Back to NPAT
        </Link>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center text-ink-muted">
        <p className="text-sm font-bold">Connecting to game server…</p>
        <Link href="/games/npat" className="mt-8 text-sm font-bold text-accent underline">
          ← Back
        </Link>
      </div>
    );
  }

  if (joinPhase === "failed") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-semibold text-ink">Could not join this room.</p>
        {joinError ? <p className="mt-3 text-sm text-red-800">{joinError}</p> : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/games/npat"
            className="rounded-2xl bg-accent px-6 py-3 text-sm font-extrabold text-white shadow-[var(--shadow-soft)]"
          >
            Back to NPAT
          </Link>
          <button
            type="button"
            className="rounded-2xl px-6 py-3 text-sm font-extrabold text-ink ring-2 ring-ink/10"
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
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/games/npat" className="text-sm font-bold text-accent underline-offset-2 hover:underline">
          ← Back
        </Link>
        <button
          type="button"
          className="text-sm font-bold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          onClick={async () => {
            await leaveRoom();
            router.push("/games/npat");
          }}
        >
          Leave room
        </button>
      </div>

      {socketError && joinPhase === "ready" ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-800">
          {socketError}
          <button type="button" className="ml-3 font-bold underline" onClick={() => clearSocketError()}>
            Dismiss
          </button>
        </p>
      ) : null}

      {actionError ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-800">
          {actionError}
          <button
            type="button"
            className="ml-3 font-bold underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </p>
      ) : null}

      {blocking ? (
        <p className="text-center text-sm font-bold text-ink-muted">Joining room…</p>
      ) : null}

      <motion.div
        layout
        className="rounded-[var(--radius-2xl)] bg-white/85 p-8 shadow-[var(--shadow-soft)] ring-2 ring-white/90 backdrop-blur-sm"
      >
        <p className="text-center text-xs font-bold uppercase tracking-widest text-ink-muted">Room code</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <span className="text-5xl font-black tracking-[0.25em] text-ink sm:text-6xl">
            {roomSynced && room?.code ? room.code : "—"}
          </span>
          <Button type="button" variant="secondary" className="shrink-0" onClick={copyCode} disabled={!roomSynced}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <p className="mt-4 text-center text-sm text-ink-muted">
          Mode: <span className="font-bold text-ink">{roomSynced ? room?.mode ?? "…" : "…"}</span>
        </p>
      </motion.div>

      <section className="rounded-[var(--radius-2xl)] bg-white/80 p-6 shadow-[var(--shadow-card)] ring-2 ring-white/80">
        <h2 className="text-xl font-extrabold text-ink">Players</h2>
        {roomSynced ? (
          <ul className="mt-4 flex flex-col gap-2">
            {players.map((p) => (
              <li
                key={p.userId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/90 px-4 py-3 ring-1 ring-ink/10"
              >
                <span className="font-bold text-ink">
                  {p.username}
                  {p.userId === room?.hostUserId ? (
                    <span className="ml-2 text-xs font-bold uppercase text-accent">Host</span>
                  ) : null}
                  {!p.connected ? (
                    <span className="ml-2 text-xs font-bold text-ink-muted">Offline</span>
                  ) : null}
                </span>
                <div className="flex items-center gap-2">
                  {room?.mode === "team" ? (
                    <select
                      className="rounded-xl border-2 border-ink/10 bg-white px-2 py-1 text-sm font-bold text-ink"
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
                    <label className="flex items-center gap-2 text-sm font-bold text-ink-muted">
                      <input
                        type="checkbox"
                        checked={Boolean(p.ready)}
                        disabled={room?.state !== "WAITING"}
                        onChange={async (e) => {
                          setActionError(null);
                          const r = await setReady(e.target.checked);
                          if (!r.ok) setActionError(r.error?.message ?? "Could not update ready state");
                        }}
                      />
                      Ready
                    </label>
                  ) : (
                    <span className="text-sm font-bold text-ink-muted">{p.ready ? "Ready" : "Not ready"}</span>
                  )}
                </div>
              </li>
            ))}
            {players.length === 0 ? <li className="text-ink-muted">No players yet.</li> : null}
          </ul>
        ) : (
          <p className="mt-4 text-ink-muted">Waiting for server…</p>
        )}
      </section>

      {roomSynced && isHost ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="primary"
            className="min-w-[12rem]"
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
            {starting ? "Starting…" : "Start game"}
          </Button>
        </div>
      ) : roomSynced ? (
        <p className="text-center text-sm font-bold text-ink-muted">Waiting for host to start…</p>
      ) : null}
    </div>
  );
}

export default function NpatLobbyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">Loading lobby…</div>
      }
    >
      <NpatLobbyInner />
    </Suspense>
  );
}
