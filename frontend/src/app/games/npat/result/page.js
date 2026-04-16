"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { useNpat } from "../../../../lib/npat/NpatSocketContext.jsx";
import { formatJoinCodeForServer } from "../../../../lib/npat/roomCode.js";
import { ResultsCarousel } from "../ResultsCarousel.jsx";

/** @typedef {'idle' | 'joining' | 'ready' | 'failed'} JoinPhase */

function NpatResultInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const { room, connected, joinRoom, clearSocketError } = useNpat();
  const [joinPhase, setJoinPhase] = useState(/** @type {JoinPhase} */ ("idle"));
  const [joinError, setJoinError] = useState(/** @type {string | null} */ (null));
  const [joinRetryToken, setJoinRetryToken] = useState(0);

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
        setJoinError(result.error?.message ?? "Could not load results");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code, normalizedCode, connected, joinRoom, clearSocketError, joinRetryToken]);

  useEffect(() => {
    if (joinPhase !== "ready" || !normalizedCode || room?.code !== normalizedCode) {
      return;
    }
    if (room?.state && room.state !== "FINISHED") {
      router.replace(`/games/npat/play?code=${room.code ?? code}`);
    }
  }, [joinPhase, room?.state, room?.code, normalizedCode, code, router]);

  const rounds = room?.results?.rounds;
  const list = Array.isArray(rounds) ? rounds : [];

  if (!code) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center text-ink-muted">
        Missing code.{" "}
        <Link href="/games/npat" className="font-bold text-accent underline">
          Home
        </Link>
      </div>
    );
  }

  if (normalizedCode === null) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-semibold text-ink">That room code is not valid.</p>
        <Link href="/games/npat" className="mt-6 inline-block font-bold text-accent underline">
          Home
        </Link>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center text-ink-muted">
        <p className="text-sm font-bold">Connecting to game server…</p>
        <Link href="/games/npat" className="mt-6 text-sm font-bold text-accent underline">
          Home
        </Link>
      </div>
    );
  }

  if (joinPhase === "failed") {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <p className="font-semibold text-ink">Could not load results.</p>
        {joinError ? <p className="mt-3 text-sm text-red-800">{joinError}</p> : null}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/games/npat" className="font-bold text-accent underline">
            Home
          </Link>
          <button
            type="button"
            className="font-bold text-ink underline"
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

  const roomSynced = joinPhase === "ready" && normalizedCode && room?.code === normalizedCode;
  const blocking = joinPhase === "idle" || joinPhase === "joining" || !roomSynced;

  if (blocking) {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col items-center justify-center px-4 py-20 text-center text-ink-muted">
        <p className="text-sm font-bold">Loading results…</p>
      </div>
    );
  }

  if (roomSynced && room?.state === "FINISHED" && list.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
        <motion.header
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">Game over</h1>
          <p className="mt-2 text-lg text-ink-muted">The game ended before any round was saved to history.</p>
        </motion.header>
        <ResultsCarousel key={`${normalizedCode}-0`} room={room} rounds={[]} />
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/games/npat"
            className="rounded-2xl bg-accent px-6 py-3 text-sm font-extrabold text-white shadow-[var(--shadow-soft)]"
          >
            Play again
          </Link>
          <Link href="/games" className="rounded-2xl px-6 py-3 text-sm font-extrabold text-ink-muted ring-2 ring-ink/10">
            All games
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14">
      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-4xl font-extrabold text-ink sm:text-5xl">Game over</h1>
        <p className="mt-2 text-lg text-ink-muted">Browse each round and player — one card at a time.</p>
      </motion.header>

      <ResultsCarousel key={`${normalizedCode}-${list.length}`} room={room} rounds={list} />

      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href="/games/npat"
          className="rounded-2xl bg-accent px-6 py-3 text-sm font-extrabold text-white shadow-[var(--shadow-soft)]"
        >
          Play again
        </Link>
        <Link href="/games" className="rounded-2xl px-6 py-3 text-sm font-extrabold text-ink-muted ring-2 ring-ink/10">
          All games
        </Link>
      </div>
    </div>
  );
}

export default function NpatResultPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">Loading results…</div>
      }
    >
      <NpatResultInner />
    </Suspense>
  );
}
