"use client";

import { useCallback, useState } from "react";
import { useFibbage } from "../../../../lib/fibbage/FibbageSocketContext.jsx";
import { FibbageButton } from "./FibbageButton.jsx";

/**
 * @param {{ phase: 'writing' | 'voting' }} props
 */
export function FibbagePhaseSkipButton({ phase }) {
  const { room, skipPhase } = useFibbage();
  const [pending, setPending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState(null);

  const permissions = room?.permissions ?? {};
  const canSkip = Boolean(permissions.canSkipPhase);
  const ready = Boolean(permissions.skipPhaseReady);
  const progress = permissions.phaseProgress ?? { done: 0, total: 0 };

  const handleSkip = useCallback(async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await skipPhase();
      if (result && !result.ok) {
        setError(result.error?.message ?? "Could not skip phase.");
      } else {
        setConfirmOpen(false);
      }
    } catch {
      setError("Could not skip phase.");
    } finally {
      setPending(false);
    }
  }, [pending, skipPhase]);

  if (!canSkip) return null;

  const actionLabel = phase === "writing" ? "submitted" : "voted";

  return (
    <div className="flex flex-col items-start gap-1">
      <FibbageButton
        variant="secondary"
        className="text-sm"
        disabled={!ready}
        pending={pending}
        onClick={() => setConfirmOpen(true)}
      >
        End phase early
      </FibbageButton>
      {progress.total > 0 ? (
        <span className="fibbage-micro text-[var(--fibbage-text-muted)]">
          {progress.done}/{progress.total} {actionLabel}
        </span>
      ) : null}
      {error ? (
        <span className="text-xs font-semibold text-[var(--fibbage-lie)]">{error}</span>
      ) : null}

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="skip-phase-title"
        >
          <div className="fibbage-card max-w-sm space-y-4 p-6">
            <h3 id="skip-phase-title" className="text-lg font-bold text-[var(--fibbage-text)]">
              Skip waiting?
            </h3>
            <p className="fibbage-body">
              Skip waiting for remaining players? They won&apos;t {phase === "writing" ? "submit" : "vote"} this round.
            </p>
            <div className="flex gap-3">
              <FibbageButton
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                Cancel
              </FibbageButton>
              <FibbageButton className="flex-1" pending={pending} onClick={() => void handleSkip()}>
                Skip
              </FibbageButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
