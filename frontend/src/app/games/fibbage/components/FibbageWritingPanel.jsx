"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { TimerBar } from "../../../../components/game-feel/TimerBar.jsx";
import { FibbagePromptCard } from "./FibbagePromptCard.jsx";
import { FibbagePlayerStatus } from "./FibbagePlayerStatus.jsx";
import { FibbageFeedbackOverlay } from "./FibbageFeedbackOverlay.jsx";

const MAX_LIE_LENGTH = 120;

export function FibbageWritingPanel() {
  const { room, submitLie } = useFibbage();
  const game = room?.game;
  const permissions = room?.permissions;
  const players = room?.players ?? [];
  const submittedIds = game?.submittedUserIds ?? [];

  const [lieText, setLieText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(!permissions?.canSubmitLie);
  const [error, setError] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const charCount = lieText.trim().length;
  const canSubmit = charCount > 0 && charCount <= MAX_LIE_LENGTH && !submitting && !submitted;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await submitLie(lieText.trim());
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not submit lie");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 2000);
    } catch {
      setError("Failed to submit. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, lieText, submitLie]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <FibbageFeedbackOverlay message={showFeedback ? "LOCKED IN" : null} />

      <TimerBar endsAt={game?.phaseEndsAt} className="mb-2" />

      <FibbagePromptCard
        text={game?.prompt?.text}
        category={game?.prompt?.category}
        round={game?.round}
        totalRounds={room?.settings?.roundCount}
      />

      <motion.div
        className="fibbage-card space-y-4 p-5"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        {submitted ? (
          <div className="py-4 text-center">
            <p className="text-lg font-bold text-[var(--fibbage-accent-glow)]">
              Lie submitted!
            </p>
            <p className="mt-1 text-sm text-[var(--fibbage-text-muted)]">
              Waiting for other players…
            </p>
          </div>
        ) : (
          <>
            <label className="block text-sm font-semibold text-[var(--fibbage-text)]">
              Write your lie
            </label>
            <input
              type="text"
              value={lieText}
              onChange={(e) => setLieText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a believable answer…"
              maxLength={MAX_LIE_LENGTH}
              disabled={submitted || submitting}
              className="w-full rounded-lg border border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas)] px-4 py-3 text-base text-[var(--fibbage-text)] placeholder:text-[var(--fibbage-text-muted)]/50 focus:border-[var(--fibbage-accent)] focus:outline-none disabled:opacity-50"
              aria-label="Your lie"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-semibold ${
                  charCount > MAX_LIE_LENGTH
                    ? "text-red-400"
                    : "text-[var(--fibbage-text-muted)]"
                }`}
              >
                {charCount}/{MAX_LIE_LENGTH}
              </span>
              <button
                className="fibbage-btn"
                onClick={handleSubmit}
                disabled={!canSubmit}
              >
                {submitting ? "Submitting…" : "Lock it in"}
              </button>
            </div>
            {error && (
              <p className="text-sm font-semibold text-red-400">{error}</p>
            )}
          </>
        )}
      </motion.div>

      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wide text-[var(--fibbage-text-muted)]">
          Players
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {players.map((player) => (
            <FibbagePlayerStatus
              key={player.userId}
              player={player}
              isSubmitted={submittedIds.includes(player.userId)}
              isVoted={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
