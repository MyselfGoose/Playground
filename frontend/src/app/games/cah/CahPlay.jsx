"use client";

import { useRouter } from "next/navigation";
import { GameFeedbackOverlay } from "../../../components/feedback/GameFeedbackOverlay.jsx";
import { Button } from "../../../components/Button.jsx";
import { BlackCardStage } from "./components/CardPieces.jsx";
import { ScoreboardRail } from "./components/ScoreboardRail.jsx";
import SubmissionCenter from "./components/SubmissionCenter.jsx";

/**
 * @param {{
 *   room: object,
 *   game: object,
 *   status: string,
 *   isJudge: boolean,
 *   pickCount: number,
 *   canSubmit: boolean,
 *   canJudge: boolean,
 *   canAdvance: boolean,
 *   hand: object[],
 *   judgeName: string,
 *   socketError: string | null,
 *   error: string,
 *   deckRecycledNotice: boolean,
 *   onDismissDeckNotice: () => void,
 *   revealFeedback: 'correct' | null,
 *   reduceMotion: boolean,
 *   selectedCards: string[],
 *   setSelectedCards: (cards: string[]) => void,
 *   selectedSubmissionId: string,
 *   setSelectedSubmissionId: (id: string) => void,
 *   run: (action: () => Promise<{ ok: boolean, error?: { message: string } }>) => Promise<{ ok: boolean }>,
 *   submitCards: (cards: string[]) => Promise<{ ok: boolean }>,
 *   judgePickWinner: (id: string) => Promise<{ ok: boolean }>,
 *   nextRound: () => Promise<{ ok: boolean }>,
 *   leaveRoom: () => Promise<{ ok: boolean }>,
 * }} props
 */
export function CahPlay({
  room,
  game,
  status,
  isJudge,
  pickCount,
  canSubmit,
  canJudge,
  canAdvance,
  hand,
  judgeName,
  socketError,
  error,
  deckRecycledNotice,
  onDismissDeckNotice,
  revealFeedback,
  reduceMotion,
  selectedCards,
  setSelectedCards,
  selectedSubmissionId,
  setSelectedSubmissionId,
  run,
  submitCards,
  judgePickWinner,
  nextRound,
  leaveRoom,
}) {
  const router = useRouter();

  return (
    <div className="relative adaptive-content-anchored mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6">
      <GameFeedbackOverlay variant={revealFeedback} reduceMotion={reduceMotion} />
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
            onClick={onDismissDeckNotice}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-[1.1fr_0.55fr]">
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
        <Button
          variant="tertiary"
          onClick={() =>
            run(() =>
              leaveRoom().then((res) => {
                if (res.ok) router.push("/games/cah");
                return res;
              }),
            )
          }
        >
          Leave Game
        </Button>
      </div>
    </div>
  );
}
