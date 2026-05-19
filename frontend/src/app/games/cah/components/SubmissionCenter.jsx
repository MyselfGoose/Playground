"use client";

import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "../../../../components/Button.jsx";
import { WhiteCard } from "./CardPieces.jsx";
import DealingStack from "./DealingStack.jsx";

export default function SubmissionCenter({
  status,
  isJudge,
  pickCount,
  canSubmit,
  canJudge,
  canAdvance,
  hand,
  submissions,
  revealOrder,
  submittedCount,
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
  const reduceMotion = useReducedMotion();

  const orderedReveals = useMemo(() => {
    const byId = new Map((submissions ?? []).map((s) => [s.submissionId, s]));
    const order = Array.isArray(revealOrder) && revealOrder.length ? revealOrder : (submissions ?? []).map((s) => s.submissionId);
    return order.map((id) => byId.get(id)).filter(Boolean);
  }, [submissions, revealOrder]);

  const placeholderCount = Math.max(0, Number(submittedCount ?? submissions?.length ?? 0));

  return (
    <section className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
      {status === "dealing" ? (
        <DealingStack label="Dealing cards for the next round…" variant="dealing" />
      ) : null}

      {status === "waiting_players" ? (
        <DealingStack label="Waiting for at least 3 connected players to continue." variant="waiting" />
      ) : null}

      {status === "submitting" ? (
        <>
          {isJudge ? (
            <p className="text-sm font-semibold text-foreground/75">You are the Card Czar this round. Waiting for submissions…</p>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground/80">
                Select exactly <span className="font-black text-primary">{pickCount}</span> card(s) and submit.
              </p>
              <motion.div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
              </motion.div>
              <Button className="mt-4 w-full sm:w-auto" variant="primary" disabled={!canSubmit || selectedCards.length !== pickCount} onClick={submitCards}>
                Submit Cards
              </Button>
            </>
          )}
        </>
      ) : null}

      {status === "judging" ? (
        <>
          <p className="text-sm font-semibold text-foreground/80">
            {canJudge ? "Pick the funniest anonymous submission." : "Judge is selecting a winner…"}
          </p>
          {canJudge ? (
            <motion.div className="mt-4 grid gap-3 md:grid-cols-2">
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
                  <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Anonymous</p>
                  <div className="mt-2 space-y-2">
                    {s.cards.map((card) => (
                      <div key={card.sourceId} className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black">
                        {card.text}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div className="mt-4 grid gap-3 md:grid-cols-2">
              {Array.from({ length: placeholderCount }, (_, i) => (
                <motion.div
                  key={`placeholder-${i}`}
                  className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-foreground/20 bg-muted-bright/15 p-4"
                  animate={reduceMotion ? undefined : { opacity: [0.55, 0.9, 0.55] }}
                  transition={reduceMotion ? undefined : { duration: 1.5, repeat: Infinity, delay: i * 0.12 }}
                >
                  <span className="text-3xl font-black text-foreground/25">?</span>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-foreground/45">Anonymous</p>
                </motion.div>
              ))}
            </motion.div>
          )}
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
            <motion.div className="mt-4 grid gap-3 md:grid-cols-2">
              {orderedReveals.map((s, index) => {
                const won = s.submissionId === winnerSubmissionId;
                return (
                  <motion.div
                    key={s.submissionId}
                    initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{
                      duration: reduceMotion ? 0 : 0.35,
                      delay: reduceMotion ? 0 : index * 0.3,
                      ease: "easeOut",
                    }}
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
            </motion.div>
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
