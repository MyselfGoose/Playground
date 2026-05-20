"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Dices, Send } from "lucide-react";
import { Button } from "../../../../components/Button.jsx";
import { TimerBar } from "../../../../components/game-feel/TimerBar.jsx";

/**
 * @param {{
 *   preview: string | null,
 *   onRandomize: () => void,
 *   onSubmit: (word: string) => void,
 *   busy?: boolean,
 *   secondsRemaining?: number,
 *   setterEndsAt?: number | null,
 * }} props
 */
export function WordPickerPanel({
  preview,
  onRandomize,
  onSubmit,
  busy,
  secondsRemaining,
  setterEndsAt = null,
}) {
  const [manual, setManual] = useState("");
  const display = preview ?? manual;
  const canSubmit = Boolean(preview || (manual.trim().length >= 4 && /^[a-zA-Z]+$/.test(manual.trim())));

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border-2 border-accent-sky/40 bg-gradient-to-br from-accent-sky/15 to-background p-6 shadow-[var(--shadow-card)] ring-1 ring-accent-sky/25"
    >
      <p className="text-sm font-black uppercase tracking-wide text-foreground/60">You pick the word</p>
      <p className="mt-1 text-xs font-semibold text-foreground/55">
        Randomize until you like it, then submit when ready.
      </p>
      {typeof setterEndsAt === "number" ? (
        <TimerBar endsAt={setterEndsAt} warnAtSeconds={10} className="mt-3 max-w-xs" />
      ) : typeof secondsRemaining === "number" && secondsRemaining > 0 ? (
        <p className="mt-1 text-xs font-black text-primary">{secondsRemaining}s to pick</p>
      ) : null}

      <motion.div
        className="mt-5 flex min-h-[4rem] items-center justify-center rounded-2xl bg-background/90 px-4 py-6 ring-1 ring-foreground/10"
        layout
      >
        <p className="font-mono text-3xl font-black tracking-widest text-primary sm:text-4xl">
          {display ? display.toLowerCase() : "····"}
        </p>
      </motion.div>

      <label className="mt-4 block">
        <span className="text-xs font-bold text-foreground/55">Or type your own</span>
        <input
          className="mt-1 w-full rounded-xl border border-foreground/15 bg-background px-3 py-2.5 font-bold lowercase"
          value={manual}
          onChange={(e) => setManual(e.target.value.replace(/[^a-zA-Z]/g, ""))}
          placeholder="mystery"
          autoComplete="off"
          autoCapitalize="none"
          inputMode="text"
          disabled={Boolean(preview) || busy}
        />
      </label>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="secondary"
          className="flex-1 gap-2"
          disabled={busy}
          onClick={onRandomize}
        >
          <Dices className="h-4 w-4" aria-hidden />
          Randomize
        </Button>
        <Button
          type="button"
          variant="primary"
          className="flex-1 gap-2"
          disabled={!canSubmit || busy}
          onClick={() => onSubmit(preview ? "" : manual)}
        >
          <Send className="h-4 w-4" aria-hidden />
          Submit word
        </Button>
      </div>
    </motion.section>
  );
}
