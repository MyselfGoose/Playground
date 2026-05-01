"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Button } from "../../../../components/Button.jsx";
import { WhiteCard } from "./CardPieces.jsx";

export default function SubmissionCenter({
  status,
  isJudge,
  pickCount,
  canSubmit,
  canJudge,
  canAdvance,
  hand,
  submissions,
  winnerSubmissionId,
  selectedCards,
  setSelectedCards,
  selectedSubmissionId,
  setSelectedSubmissionId,
  submitCards,
  judgePickWinner,
  nextRound,
  game,
}) {
  return (
    <section className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
      {status === "dealing" ? (
        <p className="text-sm font-semibold text-foreground/75">Dealing cards for the next round...</p>
      ) : null}

      {status === "waiting_players" ? (
        <p className="text-sm font-semibold text-warning">Waiting for at least 3 connected players to continue.</p>
      ) : null}

      {status === "submitting" ? (
        <>
          {isJudge ? (
            <p className="text-sm font-semibold text-foreground/75">You are the judge this round. Waiting for submissions...</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground/80">
                Select exactly <span className="font-black text-primary">{pickCount}</span> card(s) and submit.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {hand.map((card) => {
                  const selected = selectedCards.includes(card.sourceId);
                  return (
                    <WhiteCard
                      key={card.sourceId}
                      card={card}
                      selected={selected}
                      disabled={!canSubmit}
                      onClick={() => {
                        if (!canSubmit) return;
                        setSelectedCards((prev) => {
                          if (prev.includes(card.sourceId)) return prev.filter((id) => id !== card.sourceId);
                          if (prev.length >= pickCount) return prev;
                          return [...prev, card.sourceId];
                        });
                      }}
                    />
                  );
                })}
              </div>
              <Button className="mt-4 w-full sm:w-auto" variant="primary" disabled={!canSubmit || selectedCards.length !== pickCount} onClick={submitCards}>
                Submit Cards
              </Button>
            </>
          )}
        </>
      ) : null}

      {status === "judging" ? (
        <>
          <p className="text-sm font-semibold text-foreground/80">{canJudge ? "Pick the funniest anonymous submission." : "Judge is selecting a winner..."}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(submissions ?? []).map((s) => (
              <button
                key={s.submissionId}
                type="button"
                disabled={!canJudge}
                onClick={() => setSelectedSubmissionId(s.submissionId)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  selectedSubmissionId === s.submissionId
                    ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                    : "border-foreground/10 bg-muted-bright/20 hover:border-foreground/30"
                }`}
              >
                <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Submission</p>
                <div className="mt-2 space-y-2">
                  {s.cards.map((card) => (
                    <div key={card.sourceId} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black">
                      {card.text}
                    </div>
                  ))}
                </div>
              </button>
            ))}
          </div>
          {canJudge ? (
            <Button className="mt-4" variant="primary" disabled={!selectedSubmissionId} onClick={judgePickWinner}>
              Confirm Winner
            </Button>
          ) : null}
        </>
      ) : null}

      {status === "revealing" ? (
        <>
          <p className="text-sm font-semibold text-foreground/80">Winner revealed</p>
          <AnimatePresence>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(submissions ?? []).map((s) => {
                const won = s.submissionId === winnerSubmissionId;
                return (
                  <motion.div
                    key={s.submissionId}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`rounded-xl border p-3 ${won ? "border-success bg-success/10 ring-2 ring-success/30" : "border-foreground/10 bg-muted-bright/20"}`}
                  >
                    <p className="text-xs font-black uppercase tracking-wide text-foreground/60">{s.username ?? "Player"}</p>
                    <div className="mt-2 space-y-2">
                      {s.cards.map((card) => (
                        <div key={card.sourceId} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black">
                          {card.text}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
          {canAdvance ? (
            <Button className="mt-4" variant="primary" onClick={nextRound}>
              {game?.roundIndex >= game?.maxRounds ? "Finish Game" : "Next Round"}
            </Button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
