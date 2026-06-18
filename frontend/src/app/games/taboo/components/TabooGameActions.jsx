"use client";

import { AlertTriangle, SkipForward } from "lucide-react";
import { cn } from "../../../../lib/taboo/cn.js";
import { TabooButton, TabooInput } from "../ui/index.js";

/**
 * @param {{
 *   permissions: object,
 *   guess: string,
 *   onGuessChange: (value: string) => void,
 *   onSubmitGuess: () => void,
 *   onSkipCard: () => void,
 *   onCallTaboo: () => void,
 *   isRealtimeConnected: boolean,
 *   guessRowRef?: import("react").RefObject<HTMLDivElement | null>,
 *   onGuessFocus?: () => void,
 * }} props
 */
export function TabooGameActions({
  permissions,
  guess,
  onGuessChange,
  onSubmitGuess,
  onSkipCard,
  onCallTaboo,
  isRealtimeConnected,
  guessRowRef,
  onGuessFocus,
}) {
  const canSubmitGuess = Boolean(permissions?.canSubmitGuess);
  const canSkipCard = Boolean(permissions?.canSkipCard);
  const canCallTaboo = Boolean(permissions?.canCallTaboo);

  return (
    <div className="space-y-2">
      {canSubmitGuess ? (
        <div ref={guessRowRef} className="flex w-full gap-2">
          <TabooInput
            type="text"
            value={guess}
            disabled={!isRealtimeConnected}
            onChange={(e) => onGuessChange(e.target.value)}
            onFocus={onGuessFocus}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSubmitGuess();
              }
            }}
            placeholder={isRealtimeConnected ? "Type your guess…" : "Reconnecting…"}
            inputClassName="h-11 flex-1"
            aria-label="Type guess"
            className="flex-1"
          />
          <TabooButton
            variant="outlineSuccess"
            size="md"
            className="!w-auto shrink-0 px-5"
            onClick={onSubmitGuess}
            disabled={!isRealtimeConnected}
          >
            Guess
          </TabooButton>
        </div>
      ) : null}

      {canSkipCard ? (
        <button
          type="button"
          onClick={onSkipCard}
          disabled={!isRealtimeConnected}
          className={cn(
            "flex w-full flex-col items-center rounded-xl p-4 font-semibold transition-all",
            "taboo-action-outline-warning disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <SkipForward className="mb-1 h-6 w-6" />
          <span className="text-xs font-bold">Skip Card</span>
        </button>
      ) : null}

      {canCallTaboo ? (
        <button
          type="button"
          onClick={onCallTaboo}
          disabled={!isRealtimeConnected}
          className={cn(
            "flex w-full flex-col items-center rounded-xl p-4 font-semibold transition-all",
            "taboo-action-outline-danger disabled:cursor-not-allowed disabled:opacity-50",
          )}
        >
          <AlertTriangle className="mb-1 h-6 w-6" />
          <span className="text-xs font-bold">Call Taboo!</span>
        </button>
      ) : null}

      {!canSkipCard && !canCallTaboo && !canSubmitGuess ? (
        <p className="mt-3 w-full text-center text-xs text-taboo-text-faint">Watching the current turn…</p>
      ) : null}
    </div>
  );
}
