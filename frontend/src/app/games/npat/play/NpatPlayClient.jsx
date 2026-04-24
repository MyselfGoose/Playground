"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { useNpat } from "../../../../lib/npat/NpatSocketContext.jsx";
import { RoundFields } from "../RoundFields.jsx";
import { EarlyFinishVote } from "../EarlyFinishVote.jsx";
import { NpatEvaluatingPanel } from "../NpatEvaluatingPanel.jsx";
import { formatJoinCodeForServer } from "../../../../lib/npat/roomCode.js";

/** @typedef {'idle' | 'joining' | 'ready' | 'failed'} JoinPhase */

export function NpatPlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const reduce = useReducedMotion();
  const {
    room,
    connected,
    joinRoom,
    leaveRoom,
    submitField,
    proposeEarlyFinish,
    voteEarlyFinish,
    localUserId,
    socketError,
    clearSocketError,
  } = useNpat();
  const [now, setNow] = useState(() => Date.now());
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
    if (st === "WAITING") {
      router.replace(`/games/npat/lobby?code=${room?.code ?? code}`);
    }
    if (st === "FINISHED") {
      router.replace(`/games/npat/result?code=${room?.code ?? code}`);
    }
  }, [joinPhase, room?.state, room?.code, normalizedCode, code, router]);

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

  const players = Array.isArray(room?.players) ? room.players : [];

  const canSubmit =
    state === "IN_ROUND" && (roundPhase === "collecting" || roundPhase === "countdown");

  /** Full-duration red pulse while the “everyone finish up” countdown is running */
  const countdownActive =
    state === "IN_ROUND" && roundPhase === "countdown" && typeof msLeft === "number" && msLeft > 0;
  const urgent = countdownActive;

  const countdownTriggerId =
    typeof room?.countdownTriggeredByUserId === "string" && room.countdownTriggeredByUserId.trim()
      ? room.countdownTriggeredByUserId
      : null;
  const countdownTriggerName = countdownTriggerId
    ? players.find((p) => p.userId === countdownTriggerId)?.username ?? "Someone"
    : null;

  const phaseLabel =
    state === "EVALUATING"
      ? "Evaluating"
      : state === "BETWEEN_ROUNDS"
        ? "Between rounds"
        : state === "IN_ROUND" && roundPhase === "countdown"
          ? "Closing round"
          : state === "IN_ROUND" && roundPhase === "collecting"
            ? "Writing answers"
            : state === "IN_ROUND"
              ? "Round"
              : state;

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
        <p className="font-semibold text-ink">Could not load this game.</p>
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
        <p className="text-sm font-bold">Joining room…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/games/npat/lobby?code=${room?.code ?? code}`}
            className="inline-flex items-center gap-2 text-sm font-bold text-accent underline decoration-2 underline-offset-4"
          >
            <span aria-hidden>←</span> Lobby
          </Link>
          <button
            type="button"
            className="text-sm font-bold text-ink-muted underline-offset-2 hover:text-ink hover:underline"
            onClick={async () => {
              await leaveRoom();
              router.replace("/games/npat");
            }}
          >
            Leave game
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted shadow-[var(--shadow-card)] ring-1 ring-ink/10"
            title="Current game phase"
          >
            <span
              className={`h-2 w-2 rounded-full ${
                state === "EVALUATING"
                  ? "animate-pulse bg-violet-500"
                  : state === "BETWEEN_ROUNDS"
                    ? "bg-amber-400"
                    : roundPhase === "countdown"
                      ? "animate-pulse bg-red-500"
                      : "bg-emerald-400"
              }`}
              aria-hidden
            />
            {phaseLabel}
          </span>
          <span className="rounded-full bg-accent/15 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-ink ring-1 ring-accent/25">
            Round {(room?.currentRoundIndex ?? 0) + 1}
          </span>
          <EarlyFinishVote
            room={room}
            localUserId={localUserId}
            proposeEarlyFinish={proposeEarlyFinish}
            voteEarlyFinish={voteEarlyFinish}
          />
        </div>
      </header>

      {socketError ? (
        <p className="rounded-2xl border-2 border-red-200 bg-red-50 px-4 py-2 text-center text-sm font-semibold text-red-800">
          {socketError}
          <button type="button" className="ml-2 font-bold underline" onClick={() => clearSocketError()}>
            Dismiss
          </button>
        </p>
      ) : null}

      {state === "EVALUATING" ? (
        <NpatEvaluatingPanel />
      ) : state === "BETWEEN_ROUNDS" ? (
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[var(--radius-2xl)] border-2 border-accent/30 bg-gradient-to-br from-accent/20 via-white/90 to-accent-2/25 px-6 py-8 text-center shadow-[var(--shadow-soft)] ring-2 ring-white/90"
        >
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-ink-muted">Short break</p>
          <p className="mt-3 text-2xl font-black text-ink">Round scored — next letter soon</p>
          {typeof betweenLeft === "number" ? (
            <p
              className="mt-4 inline-flex min-w-[8rem] justify-center rounded-2xl bg-white/80 px-4 py-2 text-3xl font-black tabular-nums text-accent shadow-inner ring-1 ring-accent/20"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {(betweenLeft / 1000).toFixed(1)}s
            </p>
          ) : null}
          <p className="mt-2 text-sm font-semibold text-ink-muted">Get ready to write again</p>
        </motion.div>
      ) : (
        <motion.div
          animate={
            reduce || !urgent
              ? undefined
              : {
                  scale: [1, 1.015, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(220,38,38,0.45)",
                    "0 0 0 14px rgba(220,38,38,0)",
                    "0 0 0 0 rgba(220,38,38,0)",
                  ],
                }
          }
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          className={`rounded-[var(--radius-2xl)] px-6 py-10 text-center shadow-[var(--shadow-soft)] ring-2 ${
            urgent ? "bg-red-50 ring-red-400/80" : "bg-gradient-to-br from-accent/25 to-accent-2/30 ring-white/90"
          }`}
        >
          <p className="text-sm font-bold uppercase tracking-widest text-ink-muted">This round</p>
          <p
            className={`mt-2 text-7xl font-black sm:text-8xl ${urgent ? "text-red-600" : "text-ink"}`}
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {letter}
          </p>
          {countdownActive && typeof msLeft === "number" ? (
            <div className="mt-5 space-y-1">
              <p className={`text-lg font-extrabold tabular-nums ${urgent ? "text-red-700" : "text-ink-muted"}`}>
                Time left: {(msLeft / 1000).toFixed(1)}s
              </p>
              <p className="text-sm font-semibold text-red-800/90">
                Finish and submit your answers — the round closes for everyone when this hits zero.
              </p>
            </div>
          ) : null}
        </motion.div>
      )}

      {state === "IN_ROUND" && roundPhase === "countdown" && countdownTriggerName ? (
        <div
          className="flex items-start gap-3 rounded-2xl border border-red-200/80 bg-red-50/90 px-4 py-3 text-left shadow-sm ring-1 ring-red-100"
          role="status"
          aria-live="polite"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-lg" aria-hidden>
            ⏱
          </span>
          <div>
            <p className="font-extrabold text-red-900">Timer started</p>
            <p className="mt-0.5 text-sm text-red-950/90">
              {countdownTriggerId === localUserId ? (
                <>
                  You finished first — everyone else has a few seconds to lock in their answers.
                </>
              ) : (
                <>
                  <span className="font-bold">{countdownTriggerName}</span> finished first — everyone else has a few
                  seconds to lock in.
                </>
              )}
            </p>
          </div>
        </div>
      ) : null}

      {state === "IN_ROUND" ? (
        <RoundFields
          key={room?.currentRoundIndex ?? 0}
          canSubmit={canSubmit}
          mine={mine}
          players={players}
          submissions={submissions}
          localUserId={localUserId}
          roundPhase={roundPhase}
          gameState={state}
          onSubmit={(field, value) => submitField(field, value)}
        />
      ) : null}
    </div>
  );
}
