"use client";

import { useMemo, useState } from "react";
import { Button } from "../../../components/Button.jsx";

const FIELDS = [
  { key: "name", label: "Name" },
  { key: "place", label: "Place" },
  { key: "animal", label: "Animal" },
  { key: "thing", label: "Thing" },
];

/**
 * @param {Record<string, string> | undefined} row
 */
function rowComplete(row) {
  if (!row || typeof row !== "object") return false;
  return FIELDS.every((f) => Boolean(row[f.key]?.trim()));
}

/**
 * @typedef {{ ok: true, data?: unknown } | { ok: false, error?: { code?: string, message?: string } }} AckResult
 */

/**
 * @param {{
 *   canSubmit: boolean,
 *   mine: Record<string, string>,
 *   onSubmit: (field: string, value: string) => Promise<AckResult>,
 *   players?: Array<{ userId?: string, username?: string, connected?: boolean }>,
 *   submissions?: Record<string, Record<string, string>>,
 *   localUserId?: string | null,
 *   roundPhase?: string,
 *   gameState?: string,
 * }} props
 */
export function RoundFields({
  canSubmit,
  mine,
  onSubmit,
  players = [],
  submissions = {},
  localUserId = null,
  roundPhase = "none",
  gameState = "",
}) {
  const [drafts, setDrafts] = useState(() => ({ name: "", place: "", animal: "", thing: "" }));
  const [pending, setPending] = useState(
    /** @type {Record<string, boolean>} */ ({ name: false, place: false, animal: false, thing: false }),
  );
  const [errors, setErrors] = useState(
    /** @type {Record<string, string | null>} */ ({ name: null, place: null, animal: null, thing: null }),
  );

  const presence = useMemo(() => {
    if (!Array.isArray(players) || players.length === 0) return [];
    const list = [...players].filter((p) => p?.connected);
    list.sort((a, b) => {
      if (a.userId === localUserId) return -1;
      if (b.userId === localUserId) return 1;
      return (a.username ?? "").localeCompare(b.username ?? "");
    });
    return list.map((p) => {
      const uid = p.userId ?? "";
      const row = uid ? submissions[uid] : undefined;
      const done = rowComplete(row);
      return { userId: uid, username: p.username ?? "Player", done, isSelf: uid === localUserId };
    });
  }, [players, submissions, localUserId]);

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

  const showPresence = gameState === "IN_ROUND" && (roundPhase === "collecting" || roundPhase === "countdown");

  return (
    <section className="space-y-3">
      {showPresence && presence.length > 0 ? (
        <p
          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs font-semibold leading-snug text-foreground sm:text-sm"
          aria-label="Who has submitted all four answers"
        >
          {presence.map((p, i) => (
            <span key={p.userId}>
              {i > 0 ? <span className="text-foreground/50"> · </span> : null}
              <span className={p.done ? "text-success" : "text-foreground"}>
                {p.username}
                {p.isSelf ? <span className="font-normal text-foreground/60"> (you)</span> : null}
                <span className={p.done ? " text-success" : " text-warning"}>
                  {" "}
                  — {p.done ? "Done" : "Writing"}
                </span>
              </span>
            </span>
          ))}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map(({ key, label }) => {
        const filled = Boolean(mine[key]?.trim());
        const isPending = pending[key];
        const disabled = !canSubmit || filled || isPending;
        const err = errors[key];
        return (
          <div
            key={key}
            className="flex flex-col gap-2 rounded-[var(--radius-xl)] bg-muted-bright/30 p-4 shadow-[var(--shadow-md)] ring-2 ring-muted-bright/40"
          >
            <span className="text-sm font-extrabold uppercase tracking-wide text-foreground/60">{label}</span>
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
              className="w-full rounded-[var(--radius-lg)] border-2 border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-foreground placeholder-[var(--input-placeholder)] outline-none transition-all focus:border-primary focus:shadow-[0_0_0_3px_rgba(255,107,91,0.15)] disabled:opacity-60"
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
              <span className="text-sm font-semibold text-error">{err}</span>
            ) : null}
          </div>
        );
      })}
      </div>
    </section>
  );
}
