"use client";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

/**
 * @param {{
 *   guessed?: string[],
 *   wrong?: string[],
 *   disabled?: boolean,
 *   waiting?: boolean,
 *   onLetter: (letter: string) => void,
 * }} props
 */
export function LetterKeyboard({ guessed, wrong, disabled, waiting, onLetter }) {
  const g = new Set((guessed ?? []).map((c) => String(c).toLowerCase()));
  const w = new Set((wrong ?? []).map((c) => String(c).toLowerCase()));
  const locked = disabled || waiting;

  return (
    <div className="flex flex-col items-center gap-2 touch-manipulation">
      {waiting ? (
        <p className="mb-2 text-center text-xs font-bold text-foreground/50">Wait for your turn…</p>
      ) : null}
      {ROWS.map((row) => (
        <div key={row} className="flex flex-wrap justify-center gap-1.5">
          {row.split("").map((letter) => {
            const used = g.has(letter) || w.has(letter);
            const isWrong = w.has(letter);
            return (
              <button
                key={letter}
                type="button"
                disabled={locked || used}
                onClick={() => onLetter(letter)}
                className={`min-h-[44px] min-w-[2.25rem] rounded-xl px-2.5 py-2.5 text-sm font-black uppercase transition motion-safe:active:scale-95 sm:min-w-[2.5rem] ${
                  used
                    ? isWrong
                      ? "bg-error/25 text-error ring-1 ring-error/40"
                      : "bg-accent-mint/30 text-foreground ring-1 ring-accent-mint/50"
                    : locked
                      ? "bg-muted-bright/20 text-foreground/35 ring-1 ring-foreground/10"
                      : "bg-muted-bright/40 text-foreground ring-1 ring-foreground/15 hover:bg-primary/20 hover:ring-primary/40"
                }`}
              >
                {letter}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
