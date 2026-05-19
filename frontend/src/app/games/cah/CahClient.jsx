"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCah } from "../../../lib/cah/CahSocketContext.jsx";
import { Button } from "../../../components/Button.jsx";
import { BlackCardStage } from "./components/CardPieces.jsx";
import ScoreboardRail, { scoreRows } from "./components/ScoreboardRail.jsx";
import SubmissionCenter from "./components/SubmissionCenter.jsx";
import { ResultActions } from "../../../components/game/ResultActions.jsx";
import { CahEntry } from "./CahEntry.jsx";
import { CahLobby } from "./CahLobby.jsx";

export default function CahClient({ view }) {
  const router = useRouter();
  const {
    room,
    syncState,
    socketError,
    localUserId,
    leaveRoom,
    submitCards,
    judgePickWinner,
    nextRound,
  } = useCah();

  const [error, setError] = useState("");
  const [selectedCards, setSelectedCards] = useState([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState("");
  const [deckRecycledNotice, setDeckRecycledNotice] = useState(false);
  const prevDeckRecycledRef = useRef(false);
  const pathname = usePathname();

  const me = useMemo(() => room?.players?.find((p) => p.userId === localUserId) ?? null, [room?.players, localUserId]);
  const game = room?.game ?? null;
  const isJudge = game?.judgeUserId === localUserId;
  const pickCount = Number(game?.blackCard?.pick ?? 1);

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
    return (
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
              playAgainHref="/games/cah"
              secondaryLabel="Leave"
              onSecondary={() => run(() => leaveRoom().then((res) => { if (res.ok) router.push("/games/cah"); return res; }))}
            />
          </div>
        </section>
      </div>
    );
  }

  const canSubmit = Boolean(room.permissions?.canSubmitCards);
  const canJudge = Boolean(room.permissions?.canJudgePickWinner);
  const canAdvance = Boolean(room.permissions?.canNextRound);
  const hand = game?.hand ?? [];
  const judgeName = room.players?.find((p) => p.userId === game?.judgeUserId)?.username ?? "—";

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
      {socketError || error ? (
        <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
          {socketError || error}
        </p>
      ) : null}

      {deckRecycledNotice ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Deck reshuffled — cards are being reused.</p>
          <button
            type="button"
            className="text-xs font-black uppercase tracking-wide text-foreground/70 hover:text-foreground"
            onClick={() => setDeckRecycledNotice(false)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.55fr]">
        <section className="space-y-4">
          <BlackCardStage text={game?.blackCard?.text} pick={game?.blackCard?.pick} />
          <div className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-black uppercase tracking-wide text-foreground/60">
                Round {game?.roundIndex}/{game?.maxRounds}
              </p>
              <p className="text-sm font-bold capitalize text-foreground/70">{status}</p>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground/80">
              {isJudge ? (
                <span className="font-black text-primary">You are the Card Czar</span>
              ) : (
                <>Judge: {judgeName}</>
              )}
            </p>
            <p className="mt-1 text-sm text-foreground/70">
              Submissions: {game?.submittedCount ?? 0}/{game?.totalExpectedSubmissions ?? 0}
            </p>
          </div>
        </section>

        <ScoreboardRail players={room.players} judgeUserId={game?.judgeUserId} />
      </div>

      <SubmissionCenter
        status={status}
        isJudge={isJudge}
        pickCount={pickCount}
        canSubmit={canSubmit}
        canJudge={canJudge}
        canAdvance={canAdvance}
        hand={hand}
        submissions={game?.submissions ?? []}
        revealOrder={game?.revealOrder}
        submittedCount={game?.submittedCount}
        winnerSubmissionId={game?.winnerSubmissionId}
        selectedCards={selectedCards}
        setSelectedCards={setSelectedCards}
        selectedSubmissionId={selectedSubmissionId}
        setSelectedSubmissionId={setSelectedSubmissionId}
        submitCards={() => run(() => submitCards(selectedCards))}
        judgePickWinner={() => run(() => judgePickWinner(selectedSubmissionId))}
        nextRound={() => run(() => nextRound())}
        game={game}
      />

      <div className="flex items-center justify-end text-sm text-foreground/60">
        <Button variant="tertiary" onClick={() => run(() => leaveRoom().then((res) => { if (res.ok) router.push("/games/cah"); return res; }))}>
          Leave Game
        </Button>
      </div>
    </div>
  );
}
