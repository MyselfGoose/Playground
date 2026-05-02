"use client";

const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export function LetterKeyboard({ guessed, wrong, disabled, onLetter }) {
  const g = new Set((guessed ?? []).map((c) => String(c).toLowerCase()));
  const w = new Set((wrong ?? []).map((c) => String(c).toLowerCase()));

  return (
    <div className="flex flex-col gap-2 items-center">
      {ROWS.map((row) => (
        <div key={row} className="flex flex-wrap justify-center gap-1.5">
          {row.split("").map((letter) => {
            const used = g.has(letter) || w.has(letter);
            const isWrong = w.has(letter);
            return (
              <button
                key={letter}
                type="button"
                disabled={disabled || used}
                onClick={() => onLetter(letter)}
                className={`min-w-[2rem] rounded-lg px-2 py-2 text-sm font-black uppercase transition sm:min-w-[2.25rem] sm:px-3 ${
                  used
                    ? isWrong
                      ? "bg-error/25 text-error ring-1 ring-error/40"
                      : "bg-accent-mint/30 text-foreground ring-1 ring-accent-mint/50"
                    : "bg-muted-bright/40 text-foreground ring-1 ring-foreground/15 hover:bg-primary/20 hover:ring-primary/40 disabled:opacity-40"
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
