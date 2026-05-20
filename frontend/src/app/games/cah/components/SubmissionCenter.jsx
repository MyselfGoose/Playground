"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Button } from "../../../../components/Button.jsx";
import { WhiteCard } from "./CardPieces.jsx";
import DealingStack from "./DealingStack.jsx";

/**
 * @param {KeyboardEvent} event
 */
function isActivationKey(event) {
  return event.key === "Enter" || event.key === " ";
}

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
  const handGridRef = useRef(/** @type {HTMLDivElement | null} */ (null));
  const cardRefs = useRef(/** @type {(HTMLButtonElement | null)[]} */ ([]));
  const submissionRefs = useRef(/** @type {(HTMLButtonElement | null)[]} */ ([]));
  const [focusedHandIndex, setFocusedHandIndex] = useState(0);
  const [focusedSubmissionIndex, setFocusedSubmissionIndex] = useState(0);

  const orderedReveals = useMemo(() => {
    const byId = new Map((submissions ?? []).map((s) => [s.submissionId, s]));
    const order =
      Array.isArray(revealOrder) && revealOrder.length
        ? revealOrder
        : (submissions ?? []).map((s) => s.submissionId);
    return order.map((id) => byId.get(id)).filter(Boolean);
  }, [submissions, revealOrder]);

  const placeholderCount = Math.max(0, Number(submittedCount ?? submissions?.length ?? 0));
  const judgingCount = submissions?.length ?? placeholderCount;

  const toggleHandCard = useCallback(
    (index) => {
      const card = hand[index];
      if (!card || !canSubmit) return;
      setSelectedCards((prev) => {
        if (prev.includes(card.sourceId)) return prev.filter((id) => id !== card.sourceId);
        if (prev.length >= pickCount) return prev;
        return [...prev, card.sourceId];
      });
    },
    [hand, canSubmit, pickCount, setSelectedCards],
  );

  useEffect(() => {
    if (status !== "submitting" || isJudge) return;
    setFocusedHandIndex(0);
    const t = requestAnimationFrame(() => cardRefs.current[0]?.focus());
    return () => cancelAnimationFrame(t);
  }, [status, isJudge, hand.length]);

  useEffect(() => {
    if (status !== "judging" || !canJudge) return;
    setFocusedSubmissionIndex(0);
    const t = requestAnimationFrame(() => submissionRefs.current[0]?.focus());
    return () => cancelAnimationFrame(t);
  }, [status, canJudge, submissions?.length]);

  /** @param {React.KeyboardEvent<HTMLDivElement>} event */
  const onHandGridKeyDown = (event) => {
    if (status !== "submitting" || isJudge || !hand.length) return;

    const digit = Number(event.key);
    if (digit >= 1 && digit <= 9 && digit <= hand.length) {
      event.preventDefault();
      const idx = digit - 1;
      toggleHandCard(idx);
      setFocusedHandIndex(idx);
      cardRefs.current[idx]?.focus();
      return;
    }

    const cols = typeof window !== "undefined" && window.innerWidth >= 1280 ? 4 : 2;
    let next = focusedHandIndex;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      next = Math.min(hand.length - 1, focusedHandIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      next = Math.max(0, focusedHandIndex - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      next = Math.min(hand.length - 1, focusedHandIndex + cols);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      next = Math.max(0, focusedHandIndex - cols);
    } else if (isActivationKey(event)) {
      event.preventDefault();
      toggleHandCard(focusedHandIndex);
      return;
    } else {
      return;
    }

    setFocusedHandIndex(next);
    cardRefs.current[next]?.focus();
  };

  /** @param {React.KeyboardEvent<HTMLDivElement>} event */
  const onJudgingKeyDown = (event) => {
    if (status !== "judging" || !canJudge || !submissions?.length) return;

    const digit = Number(event.key);
    if (digit >= 1 && digit <= 9 && digit <= submissions.length) {
      event.preventDefault();
      const idx = digit - 1;
      const sub = submissions[idx];
      if (sub) {
        setSelectedSubmissionId(sub.submissionId);
        setFocusedSubmissionIndex(idx);
        submissionRefs.current[idx]?.focus();
      }
      return;
    }

    let next = focusedSubmissionIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      next = Math.min(submissions.length - 1, focusedSubmissionIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      next = Math.max(0, focusedSubmissionIndex - 1);
    } else if (isActivationKey(event)) {
      event.preventDefault();
      const sub = submissions[focusedSubmissionIndex];
      if (sub) setSelectedSubmissionId(sub.submissionId);
      return;
    } else {
      return;
    }

    setFocusedSubmissionIndex(next);
    submissionRefs.current[next]?.focus();
  };

  const judgingAnnouncement =
    status === "judging"
      ? isJudge
        ? `${judgingCount} submission${judgingCount === 1 ? "" : "s"} to judge`
        : `${judgingCount} submission${judgingCount === 1 ? "" : "s"} received. Waiting for the judge.`
      : "";

  return (
    <section className="rounded-[22px] border border-foreground/10 bg-background/90 p-4 shadow-[var(--shadow-card)]">
      {judgingAnnouncement ? (
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {judgingAnnouncement}
        </p>
      ) : null}

      {status === "dealing" ? (
        <DealingStack label="Dealing cards for the next round…" variant="dealing" />
      ) : null}

      {status === "waiting_players" ? (
        <DealingStack label="Waiting for at least 3 connected players to continue." variant="waiting" />
      ) : null}

      {status === "submitting" ? (
        <>
          {isJudge ? (
            <p className="text-sm font-semibold text-foreground/80">
              You are the Card Czar this round. Waiting for submissions…
            </p>
          ) : (
            <>
              <p className="text-sm font-semibold text-foreground/80">
                Select exactly <span className="font-black text-primary">{pickCount}</span> card(s) and submit.
                Use arrow keys or number keys 1–{Math.min(9, hand.length)}.
              </p>
              <motion.div
                ref={handGridRef}
                className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
                role="listbox"
                aria-label="Your white cards"
                aria-multiselectable="true"
                onKeyDown={onHandGridKeyDown}
              >
                {hand.map((card, index) => {
                  const selected = selectedCards.includes(card.sourceId);
                  const shortcut = index < 9 ? ` Press ${index + 1} to select.` : "";
                  return (
                    <WhiteCard
                      key={card.sourceId}
                      card={card}
                      selected={selected}
                      disabled={!canSubmit}
                      tabIndex={index === focusedHandIndex ? 0 : -1}
                      cardRef={(el) => {
                        cardRefs.current[index] = el;
                      }}
                      ariaLabel={`White card: ${card.text}.${shortcut}`}
                      onClick={() => toggleHandCard(index)}
                      onKeyDown={(e) => {
                        if (isActivationKey(e)) {
                          e.preventDefault();
                          toggleHandCard(index);
                        }
                      }}
                    />
                  );
                })}
              </motion.div>
              <Button
                className="mt-4 w-full sm:w-auto"
                variant="primary"
                disabled={!canSubmit || selectedCards.length !== pickCount}
                onClick={submitCards}
              >
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
            <motion.div
              className="mt-4 grid gap-3 md:grid-cols-2"
              role="listbox"
              aria-label="Anonymous submissions"
              onKeyDown={onJudgingKeyDown}
            >
              {(submissions ?? []).map((s, index) => (
                <button
                  key={s.submissionId}
                  ref={(el) => {
                    submissionRefs.current[index] = el;
                  }}
                  type="button"
                  disabled={!canJudge}
                  tabIndex={index === focusedSubmissionIndex ? 0 : -1}
                  aria-label={`Submission ${index + 1}. Press ${index + 1} to select.`}
                  onClick={() => setSelectedSubmissionId(s.submissionId)}
                  className={`rounded-xl border p-3 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    selectedSubmissionId === s.submissionId
                      ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                      : "border-foreground/10 bg-muted-bright/20 hover:border-foreground/30"
                  }`}
                >
                  <p className="text-xs font-black uppercase tracking-wide text-foreground/70">Anonymous</p>
                  <div className="mt-2 space-y-2">
                    {s.cards.map((card) => (
                      <div
                        key={card.sourceId}
                        className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black"
                      >
                        {card.text}
                      </div>
                    ))}
                  </div>
                </button>
              ))}
            </motion.div>
          ) : (
            <motion.div className="mt-4 grid gap-3 md:grid-cols-2" aria-hidden>
              {Array.from({ length: placeholderCount }, (_, i) => (
                <motion.div
                  key={`placeholder-${i}`}
                  className="flex min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-foreground/20 bg-muted-bright/15 p-4"
                  animate={reduceMotion ? undefined : { opacity: [0.55, 0.9, 0.55] }}
                  transition={reduceMotion ? undefined : { duration: 1.5, repeat: Infinity, delay: i * 0.12 }}
                >
                  <span className="text-3xl font-black text-foreground/35">?</span>
                  <p className="mt-2 text-xs font-bold uppercase tracking-wide text-foreground/55">Anonymous</p>
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
                    <p className="text-xs font-black uppercase tracking-wide text-foreground/70">
                      {s.username ?? "Player"}
                    </p>
                    <div className="mt-2 space-y-2">
                      {s.cards.map((card) => (
                        <div
                          key={card.sourceId}
                          className="rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-bold text-black"
                        >
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
