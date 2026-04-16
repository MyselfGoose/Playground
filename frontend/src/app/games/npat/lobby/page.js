"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useNpat } from "../../../../lib/npat/NpatSocketContext.jsx";
import { Button } from "../../../../components/Button.jsx";

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
    setSocketError,
    localUserId,
  } = useNpat();

  const joinedRef = useRef(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code || !connected || joinedRef.current) return;
    joinedRef.current = true;
    joinRoom(code);
  }, [code, connected, joinRoom]);

  useEffect(() => {
    const st = room?.state;
    if (!st || st === "WAITING") return;
    if (st === "FINISHED") {
      router.replace(`/games/npat/result?code=${room.code}`);
      return;
    }
    router.replace(`/games/npat/play?code=${room.code}`);
  }, [room?.state, room?.code, router]);

  const copyCode = useCallback(() => {
    if (!room?.code) return;
    void navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [room]);

  const isHost = localUserId && room?.hostUserId === localUserId;
  const players = Array.isArray(room?.players) ? room.players : [];

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/games/npat" className="text-sm font-bold text-accent underline-offset-2 hover:underline">
          ← Back
        </Link>
        <button
          type="button"
          className="text-sm font-bold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
          onClick={() => {
            leaveRoom();
            router.push("/games/npat");
          }}
        >
          Leave room
        </button>
      </div>

      {socketError ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-semibold text-red-800">
          {socketError}
          <button type="button" className="ml-3 font-bold underline" onClick={() => setSocketError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      <motion.div
        layout
        className="rounded-[var(--radius-2xl)] bg-white/85 p-8 shadow-[var(--shadow-soft)] ring-2 ring-white/90 backdrop-blur-sm"
      >
        <p className="text-center text-xs font-bold uppercase tracking-widest text-ink-muted">Room code</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
          <span className="text-5xl font-black tracking-[0.25em] text-ink sm:text-6xl">
            {room?.code ?? code.padStart(4, "0")}
          </span>
          <Button type="button" variant="secondary" className="shrink-0" onClick={copyCode} disabled={!room?.code}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
        <p className="mt-4 text-center text-sm text-ink-muted">
          Mode: <span className="font-bold text-ink">{room?.mode ?? "…"}</span>
        </p>
      </motion.div>

      <section className="rounded-[var(--radius-2xl)] bg-white/80 p-6 shadow-[var(--shadow-card)] ring-2 ring-white/80">
        <h2 className="text-xl font-extrabold text-ink">Players</h2>
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
                    onChange={(e) => switchTeam(e.target.value)}
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
                      onChange={(e) => setReady(e.target.checked)}
                    />
                    Ready
                  </label>
                ) : (
                  <span className="text-sm font-bold text-ink-muted">{p.ready ? "Ready" : "Not ready"}</span>
                )}
              </div>
            </li>
          ))}
          {players.length === 0 ? <li className="text-ink-muted">Waiting for room…</li> : null}
        </ul>
      </section>

      {isHost ? (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="primary"
            className="min-w-[12rem]"
            disabled={!connected || room?.state !== "WAITING"}
            onClick={() => {
              setSocketError(null);
              startGame();
            }}
          >
            Start game
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm font-bold text-ink-muted">Waiting for host to start…</p>
      )}
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
