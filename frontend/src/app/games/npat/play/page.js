"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useNpat } from "../../../../lib/npat/NpatSocketContext.jsx";
import { RoundFields } from "../RoundFields.jsx";

function NpatPlayInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const reduce = useReducedMotion();
  const { room, connected, joinRoom, submitField, localUserId, socketError, setSocketError } = useNpat();
  const joinedRef = useRef(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!code || !connected || joinedRef.current) return;
    joinedRef.current = true;
    joinRoom(code);
  }, [code, connected, joinRoom]);

  useEffect(() => {
    const st = room?.state;
    if (st === "WAITING") {
      router.replace(`/games/npat/lobby?code=${room?.code ?? code}`);
    }
    if (st === "FINISHED") {
      router.replace(`/games/npat/result?code=${room?.code ?? code}`);
    }
  }, [room?.state, room?.code, code, router]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const msLeft = useMemo(() => {
    const end = room?.timerEndsAt;
    if (typeof end !== "number") return null;
    return Math.max(0, end - now);
  }, [room?.timerEndsAt, now]);

  const betweenLeft = useMemo(() => {
    const end = room?.betweenRoundsEndsAt;
    if (typeof end !== "number") return null;
    return Math.max(0, end - now);
  }, [room?.betweenRoundsEndsAt, now]);

  const letter = room?.currentLetter ?? "—";
  const state = room?.state ?? "";
  const roundPhase = room?.roundPhase ?? "none";
  const submissions =
    room?.submissions && typeof room.submissions === "object"
      ? /** @type {Record<string, Record<string, string>>} */ (room.submissions)
      : {};
  const mine = localUserId ? submissions[localUserId] ?? {} : {};

  const canSubmit =
    state === "IN_ROUND" && (roundPhase === "collecting" || roundPhase === "countdown");

  const urgent = typeof msLeft === "number" && msLeft < 3000 && msLeft > 0;

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

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/games/npat/lobby?code=${room?.code ?? code}`} className="text-sm font-bold text-accent underline">
          ← Lobby
        </Link>
        <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-bold uppercase text-ink-muted ring-1 ring-ink/10">
          Round {(room?.currentRoundIndex ?? 0) + 1}
        </span>
      </div>

      {socketError ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-800">
          {socketError}
          <button type="button" className="ml-2 font-bold underline" onClick={() => setSocketError(null)}>
            Dismiss
          </button>
        </p>
      ) : null}

      <motion.div
        animate={
          reduce || !urgent
            ? undefined
            : {
                scale: [1, 1.02, 1],
                boxShadow: [
                  "0 0 0 0 rgba(220,38,38,0.35)",
                  "0 0 0 12px rgba(220,38,38,0)",
                  "0 0 0 0 rgba(220,38,38,0)",
                ],
              }
        }
        transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
        className={`rounded-[var(--radius-2xl)] px-6 py-10 text-center shadow-[var(--shadow-soft)] ring-2 ${
          urgent ? "bg-red-50 ring-red-300" : "bg-gradient-to-br from-accent/25 to-accent-2/30 ring-white/90"
        }`}
      >
        <p className="text-sm font-bold uppercase tracking-widest text-ink-muted">This round</p>
        <p
          className={`mt-2 text-7xl font-black sm:text-8xl ${urgent ? "text-red-600" : "text-ink"}`}
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {letter}
        </p>
        {typeof msLeft === "number" && roundPhase === "countdown" ? (
          <p className={`mt-4 text-lg font-extrabold ${urgent ? "text-red-600" : "text-ink-muted"}`}>
            Round ends in {(msLeft / 1000).toFixed(1)}s
          </p>
        ) : null}
        {typeof betweenLeft === "number" && room?.state === "BETWEEN_ROUNDS" ? (
          <p className="mt-4 text-lg font-extrabold text-accent">
            Next round in {(betweenLeft / 1000).toFixed(1)}s…
          </p>
        ) : null}
      </motion.div>

      <RoundFields
        key={room?.currentRoundIndex ?? 0}
        canSubmit={canSubmit}
        mine={mine}
        onSubmit={(field, value) => submitField(field, value)}
      />
    </div>
  );
}

export default function NpatPlayPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center px-4 py-20 text-ink-muted">Loading game…</div>
      }
    >
      <NpatPlayInner />
    </Suspense>
  );
}
