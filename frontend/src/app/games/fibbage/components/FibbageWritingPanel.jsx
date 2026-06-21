"use client";

import { useCallback, useMemo, useState } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { usePhaseCountdown } from "../../../../lib/fibbage/usePhaseCountdown.js";
import { Avatar } from "../../../../components/Avatar.jsx";
import { FibbageTimerBar } from "./FibbageTimerBar.jsx";

export function FibbageWritingPanel() {
  const { room, submitLie } = useFibbage();
  const game = room?.game;
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(null);

  const writingSeconds = room?.settings?.writingSeconds ?? 90;
  const secondsRemaining = usePhaseCountdown(game?.phaseEndsAt, writingSeconds);
  const canSubmit = Boolean(game?.permissions?.canSubmitLie);
  const submitted = Boolean(game?.permissions?.ownSubmissionLocked);
  const submittedUserIds = game?.submittedUserIds ?? [];

  const waitingFor = useMemo(() => {
    const activePlayers = room?.players?.filter((p) => p.connected !== false) ?? [];
    return activePlayers.filter((p) => !submittedUserIds.includes(p.userId));
  }, [room?.players, submittedUserIds]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || pending || !text.trim()) return;
    setPending(true);
    setError(null);
    try {
      const result = await submitLie(text.trim());
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not submit lie.");
      } else {
        setText("");
      }
    } catch {
      setError("Could not submit lie.");
    } finally {
      setPending(false);
    }
  }, [canSubmit, pending, submitLie, text]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="fibbage-card text-center">
        <p className="text-sm text-[var(--fibbage-text-muted)]">Fill in the blank with a convincing lie</p>
        <p className="mt-3 text-xl font-bold leading-relaxed text-[var(--fibbage-text)]">
          {game?.prompt?.text}
        </p>
      </div>

      {submitted ? (
        <div className="fibbage-card text-center">
          <p className="font-bold text-[var(--fibbage-accent)]">Lie submitted!</p>
          <p className="mt-2 text-sm text-[var(--fibbage-text-muted)]">
            Waiting for {waitingFor.length} player{waitingFor.length === 1 ? "" : "s"}…
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {waitingFor.map((player) => (
              <div key={player.userId} className="flex items-center gap-2 rounded-lg bg-[var(--fibbage-canvas)] px-3 py-1.5">
                <Avatar
                  username={player.username}
                  avatarUrl={player.avatarUrl}
                  avatarEmoji={player.avatarEmoji}
                  size="sm"
                />
                <span className="text-xs font-semibold">{player.username}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="fibbage-card space-y-4">
          <label className="block text-sm font-semibold text-[var(--fibbage-text)]" htmlFor="fibbage-lie">
            Your lie
          </label>
          <textarea
            id="fibbage-lie"
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={120}
            rows={3}
            disabled={!canSubmit || pending}
            placeholder="Make it believable…"
            className="w-full resize-none rounded-xl border border-[var(--fibbage-card-border)] bg-[var(--fibbage-canvas)] px-4 py-3 text-[var(--fibbage-text)] outline-none focus:border-[var(--fibbage-accent)]"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-[var(--fibbage-text-muted)]">{text.length}/120</span>
            <button
              type="button"
              className="fibbage-btn"
              disabled={!canSubmit || pending || text.trim().length < 3}
              onClick={() => void handleSubmit()}
            >
              {pending ? "Submitting…" : "Submit lie"}
            </button>
          </div>
          {error ? <p className="text-sm font-semibold text-[var(--fibbage-lie)]">{error}</p> : null}
        </div>
      )}

      <FibbageTimerBar secondsRemaining={secondsRemaining} totalSeconds={writingSeconds} />

      <p className="text-center text-xs text-[var(--fibbage-text-muted)]">
        {submittedUserIds.length} of {room?.players?.filter((p) => p.connected !== false).length ?? 0} submitted
      </p>
    </div>
  );
}
