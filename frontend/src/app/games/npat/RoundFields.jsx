"use client";

import { useState } from "react";
import { Button } from "../../../components/Button.jsx";

const FIELDS = [
  { key: "name", label: "Name" },
  { key: "place", label: "Place" },
  { key: "animal", label: "Animal" },
  { key: "thing", label: "Thing" },
];

/**
 * @typedef {{ ok: true, data?: unknown } | { ok: false, error?: { code?: string, message?: string } }} AckResult
 */

/**
 * @param {{
 *   canSubmit: boolean,
 *   mine: Record<string, string>,
 *   onSubmit: (field: string, value: string) => Promise<AckResult>,
 * }} props
 */
export function RoundFields({ canSubmit, mine, onSubmit }) {
  const [drafts, setDrafts] = useState(() => ({ name: "", place: "", animal: "", thing: "" }));
  const [pending, setPending] = useState(
    /** @type {Record<string, boolean>} */ ({ name: false, place: false, animal: false, thing: false }),
  );
  const [errors, setErrors] = useState(
    /** @type {Record<string, string | null>} */ ({ name: null, place: null, animal: null, thing: null }),
  );

  async function handleSubmit(key) {
    const value = drafts[key].trim();
    if (!value) return;
    setPending((p) => ({ ...p, [key]: true }));
    setErrors((e) => ({ ...e, [key]: null }));
    const result = await onSubmit(key, value);
    setPending((p) => ({ ...p, [key]: false }));
    if (!result.ok) {
      setErrors((e) => ({ ...e, [key]: result.error?.message ?? "Could not submit" }));
    }
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map(({ key, label }) => {
        const filled = Boolean(mine[key]?.trim());
        const isPending = pending[key];
        const disabled = !canSubmit || filled || isPending;
        const err = errors[key];
        return (
          <div
            key={key}
            className="flex flex-col gap-2 rounded-[var(--radius-xl)] bg-white/85 p-4 shadow-[var(--shadow-card)] ring-2 ring-white/80"
          >
            <span className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">{label}</span>
            <input
              value={filled ? mine[key] : drafts[key]}
              disabled={disabled}
              onChange={(e) => {
                setDrafts((d) => ({ ...d, [key]: e.target.value }));
                if (err) setErrors((prev) => ({ ...prev, [key]: null }));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !disabled && drafts[key].trim()) {
                  void handleSubmit(key);
                }
              }}
              className="w-full rounded-2xl border-2 border-ink/10 bg-white px-3 py-2 text-ink outline-none focus:border-accent/40 disabled:bg-ink/5"
              placeholder="Your answer…"
            />
            <Button
              type="button"
              variant={filled ? "secondary" : "primary"}
              className="w-full"
              disabled={disabled || !drafts[key].trim()}
              onClick={() => void handleSubmit(key)}
            >
              {filled ? "Saved" : isPending ? "Submitting…" : "Submit"}
            </Button>
            {err ? (
              <span className="text-sm font-semibold text-red-700">{err}</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
