"use client";

import { useMemo } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { Avatar } from "../../../../components/Avatar.jsx";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";

const STEP_HEADINGS = {
  votes_summary: "Vote summary",
  per_lie: "Who wrote what?",
  truth: "The truth revealed",
  complete: "Round complete",
};

export function FibbageRevealStage() {
  const { room } = useFibbage();
  const game = room?.game;
  const players = room?.players ?? [];
  const step = game?.reveal?.step ?? "votes_summary";
  const revealEndsAt = game?.reveal?.phaseEndsAt ?? game?.phaseEndsAt;
  const secondsRemaining = usePhaseCountdown(revealEndsAt, 4);
  const answers = game?.answers ?? [];
  const roundScores = game?.roundScores ?? {};

  const heading = STEP_HEADINGS[step] ?? "Results";

  const sortedAnswers = useMemo(() => {
    return [...answers].sort((a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0));
  }, [answers]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--fibbage-accent)]">{heading}</p>
        <h2 className="mt-2 text-xl font-black text-[var(--fibbage-text)]">{game?.prompt?.text}</h2>
      </div>

      <div className="grid gap-3">
        {sortedAnswers.map((answer) => {
          const author = answer.authorUserId
            ? players.find((p) => p.userId === answer.authorUserId)
            : null;
          const voters = (answer.voters ?? []).map((id) => players.find((p) => p.userId === id)).filter(Boolean);
          const isTruth = Boolean(answer.isTruth);
          const roundPoints =
            answer.authorUserId && roundScores[answer.authorUserId]
              ? roundScores[answer.authorUserId].totalRoundPoints
              : null;

          return (
            <div
              key={answer.answerId}
              className={`fibbage-card ${isTruth ? "fibbage-card--truth" : ""}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="flex-1 font-semibold text-[var(--fibbage-text)]">{answer.text}</p>
                {typeof answer.voteCount === "number" ? (
                  <span className="rounded-full bg-[var(--fibbage-canvas)] px-3 py-1 text-xs font-bold text-[var(--fibbage-gold)]">
                    {answer.voteCount} vote{answer.voteCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              {author ? (
                <div className="mt-3 flex items-center gap-2">
                  <Avatar
                    username={author.username}
                    avatarUrl={author.avatarUrl}
                    avatarEmoji={author.avatarEmoji}
                    size="sm"
                  />
                  <span className="text-sm font-bold text-[var(--fibbage-accent)]">
                    {author.username} wrote this
                  </span>
                  {roundPoints ? (
                    <span className="text-sm font-bold text-[var(--fibbage-gold)]">+{roundPoints}</span>
                  ) : null}
                </div>
              ) : null}

              {isTruth ? (
                <p className="mt-2 text-xs font-bold uppercase text-[var(--fibbage-truth)]">The truth</p>
              ) : null}

              {voters.length > 0 ? (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[var(--fibbage-text-muted)]">Fooled:</span>
                  {voters.map((voter) => (
                    <div key={voter.userId} className="flex items-center gap-1.5 rounded-lg bg-[var(--fibbage-canvas)] px-2 py-1">
                      <Avatar
                        username={voter.username}
                        avatarUrl={voter.avatarUrl}
                        avatarEmoji={voter.avatarEmoji}
                        size="sm"
                      />
                      <span className="text-xs font-semibold">{voter.username}</span>
                    </div>
                  ))}
                </div>
              ) : step !== "votes_summary" && !author && !isTruth ? (
                <p className="mt-2 text-xs text-[var(--fibbage-text-muted)]">No votes</p>
              ) : null}
            </div>
          );
        })}
      </div>

      {step === "votes_summary" ? (
        <p className="text-center text-sm text-[var(--fibbage-text-muted)]">
          Authors and voters will be revealed next…
        </p>
      ) : null}

      <FibbageTimerBar secondsRemaining={secondsRemaining} totalSeconds={4} />
    </div>
  );
}
