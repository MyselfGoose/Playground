"use client";

import dynamic from "next/dynamic";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { LoadingSkeleton } from "../../../components/LoadingSkeleton.jsx";
import { ResultGate } from "../../../components/game-feel/WinnerBanner.jsx";
import { usePathname, useRouter } from "next/navigation";
import { useCah } from "../../../lib/cah/CahSocketContext.jsx";
import { Button } from "../../../components/Button.jsx";
import { scoreRows } from "./components/ScoreboardRail.jsx";
import { ResultActions } from "../../../components/game/ResultActions.jsx";
import { CahEntry } from "./CahEntry.jsx";
import { CahLobby } from "./CahLobby.jsx";

const CahPlay = dynamic(
  () => import("./CahPlay.jsx").then((m) => ({ default: m.CahPlay })),
  { ssr: false, loading: () => <LoadingSkeleton variant="playfield" /> },
);

export default function CahClient({ view }) {
  const router = useRouter();
  const {
    room,
    syncState,
    socketError,
    localUserId,
    leaveRoom,
    returnToLobby,
    submitCards,
    judgePickWinner,
    nextRound,
  } = useCah();

  const [error, setError] = useState("");
  const [selectedCards, setSelectedCards] = useState(/** @type {string[]} */ ([]));
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [deckRecycledNotice, setDeckRecycledNotice] = useState(false);
  const [revealFeedback, setRevealFeedback] = useState(/** @type {null | 'correct'} */ (null));
  const [rematchBusy, setRematchBusy] = useState(false);
  const prevDeckRecycledRef = useRef(false);
  const prevStatusRef = useRef("");
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const me = useMemo(() => room?.players?.find((p) => p.userId === localUserId) ?? null, [room?.players, localUserId]);
  const game = room?.game ?? null;
  const isHost = Boolean(localUserId && room?.hostId === localUserId);
  const isJudge = game?.judgeUserId === localUserId;
  const pickCount = Number(game?.blackCard?.pick ?? 1);

  useEffect(() => {
    const status = game?.status ?? "";
    if (status === "revealing" && prevStatusRef.current !== "revealing" && !reduceMotion) {
      setRevealFeedback("correct");
      const t = setTimeout(() => setRevealFeedback(null), 650);
      return () => clearTimeout(t);
    }
    prevStatusRef.current = status;
    return undefined;
  }, [game?.status, reduceMotion]);

  useEffect(() => {
    const targetRoute = !room?.code
      ? view === "entry"
        ? null
        : "/games/cah"
      : game?.status === "finished"
        ? "/games/cah/result"
        : game
          ? "/games/cah/play"
          : "/games/cah/lobby";
    if (!targetRoute || syncState !== "ready") return;
    if (pathname !== targetRoute) router.replace(targetRoute);
  }, [view, room?.code, game?.status, syncState, pathname, router, game]);

  useEffect(() => {
    setSelectedCards([]);
    setSelectedSubmissionId("");
  }, [game?.roundIndex, game?.status]);

  useEffect(() => {
    const recycled = Boolean(room?.deckRecycled);
    if (recycled && !prevDeckRecycledRef.current) {
      setDeckRecycledNotice(true);
    }
    prevDeckRecycledRef.current = recycled;
  }, [room?.deckRecycled]);

  async function run(action) {
    const result = await action();
    if (!result.ok) setError(result.error.message);
    else setError("");
    return result;
  }

  if (view === "entry") {
    return (
      <Suspense fallback={<div className="px-4 py-20 text-center text-foreground/60">Loading…</div>}>
        <CahEntry />
      </Suspense>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto flex min-h-[60vh] w-full max-w-3xl flex-col items-center justify-center gap-4 px-4 py-10 text-center">
        <p className="text-lg font-black text-foreground">Syncing room state…</p>
        <p className="text-sm font-semibold text-foreground/65">
          If this takes too long, return to the lobby and join again.
        </p>
        <Button variant="secondary" onClick={() => router.replace("/games/cah")}>
          Back to CAH Home
        </Button>
      </div>
    );
  }

  if (view === "lobby") {
    return <CahLobby room={room} error={error} setError={setError} run={run} />;
  }

  const status = game?.status ?? "lobby";
  const isFinished = status === "finished";
  if (view === "result" || isFinished) {
    const rows = scoreRows(room.players ?? []);
    const top = rows[0];
    return (
      <ResultGate
        title={top ? `${top.username} wins!` : "Game finished"}
        subtitle="Best score wins — thanks for playing!"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-10">
          <section className="rounded-[30px] border border-foreground/10 bg-background/90 p-6 text-center shadow-[var(--shadow-card)] sm:p-8">
            <h2 className="text-4xl font-black text-foreground">Game Finished</h2>
            <p className="mt-2 text-foreground/70">Best score wins. Thanks for playing!</p>
          </section>
          <section className="rounded-[26px] border border-foreground/10 bg-background/90 p-5 shadow-[var(--shadow-card)]">
            <h3 className="text-xl font-black text-foreground">Final Standings</h3>
            <div className="mt-3 space-y-2">
              {rows.map((p, idx) => (
                <div key={p.userId} className="flex items-center justify-between rounded-xl bg-muted-bright/25 px-4 py-3 ring-1 ring-foreground/10">
                  <p className="font-bold text-foreground">
                    #{idx + 1} {p.username}
                  </p>
                  <p className="text-xl font-black text-primary">{p.score ?? 0}</p>
                </div>
              ))}
            </div>
            <div className="mt-6">
              <ResultActions
                playAgainLabel="Play again"
                onPlayAgain={
                  isHost
                    ? () =>
                        void (async () => {
                          setRematchBusy(true);
                          const res = await returnToLobby();
                          setRematchBusy(false);
                          if (res.ok && room?.code) {
                            router.push(`/games/cah?code=${encodeURIComponent(room.code)}`);
                          }
                        })()
                    : undefined
                }
                playAgainHref={isHost ? undefined : "/games/cah"}
                playAgainDisabled={rematchBusy}
                secondaryLabel="Leave"
                onSecondary={() =>
                  run(() =>
                    leaveRoom().then((res) => {
                      if (res.ok) router.push("/games/cah");
                      return res;
                    }),
                  )
                }
              />
            </div>
          </section>
        </div>
      </ResultGate>
    );
  }

  const canSubmit = Boolean(room.permissions?.canSubmitCards);
  const canJudge = Boolean(room.permissions?.canJudgePickWinner);
  const canAdvance = Boolean(room.permissions?.canNextRound);
  const hand = game?.hand ?? [];
  const judgeName = room.players?.find((p) => p.userId === game?.judgeUserId)?.username ?? "—";

  return (
    <CahPlay
      room={room}
      game={game}
      status={status}
      isJudge={isJudge}
      pickCount={pickCount}
      canSubmit={canSubmit}
      canJudge={canJudge}
      canAdvance={canAdvance}
      hand={hand}
      judgeName={judgeName}
      socketError={socketError}
      error={error}
      deckRecycledNotice={deckRecycledNotice}
      onDismissDeckNotice={() => setDeckRecycledNotice(false)}
      revealFeedback={revealFeedback}
      reduceMotion={reduceMotion}
      selectedCards={selectedCards}
      setSelectedCards={setSelectedCards}
      selectedSubmissionId={selectedSubmissionId}
      setSelectedSubmissionId={setSelectedSubmissionId}
      run={run}
      submitCards={submitCards}
      judgePickWinner={judgePickWinner}
      nextRound={nextRound}
      leaveRoom={leaveRoom}
    />
  );
}
