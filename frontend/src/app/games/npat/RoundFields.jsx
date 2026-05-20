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
 * @param {Array<{ userId?: string, teamId?: string, connected?: boolean }>} players
 * @param {Record<string, Record<string, string>>} submissions
 * @param {string} teamId
 * @param {string} field
 */
function teamHasField(players, submissions, teamId, field) {
  for (const p of players) {
    if (!p?.connected || p.teamId !== teamId) continue;
    const uid = p.userId ?? "";
    const value = uid ? submissions[uid]?.[field] : "";
    if (typeof value === "string" && value.trim()) return true;
  }
  return false;
}

/**
 * @param {{
 *   canSubmit: boolean,
 *   mine: Record<string, string>,
 *   onSubmit: (field: string, value: string) => Promise<AckResult>,
 *   players?: Array<{ userId?: string, username?: string, connected?: boolean, teamId?: string }>,
 *   submissions?: Record<string, Record<string, string>>,
 *   localUserId?: string | null,
 *   roundPhase?: string,
 *   gameState?: string,
 *   mode?: string,
 *   teams?: Array<{ id: string, name: string }>,
 *   onFieldComplete?: () => void,
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
  mode = "",
  teams = [],
  onFieldComplete,
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
    } else {
      onFieldComplete?.();
    }
  }

  const showPresence =
    mode !== "team" && gameState === "IN_ROUND" && (roundPhase === "collecting" || roundPhase === "countdown");

  const showTeamGrid =
    mode === "team" && gameState === "IN_ROUND" && teams.length > 0;

  return (
    <section className="space-y-3">
      {showTeamGrid ? (
        <div className="overflow-x-auto rounded-[var(--radius-xl)] border border-muted-bright/60 bg-muted-bright/20 p-3">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-foreground/55">Team progress</p>
          <table className="w-full min-w-[16rem] border-collapse text-left text-sm">
            <thead>
              <tr>
                <th className="pb-2 pr-3 font-bold text-foreground/60">Category</th>
                {teams.map((t) => (
                  <th key={t.id} className="pb-2 px-2 text-center font-bold text-foreground">
                    {t.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(({ key, label }) => (
                <tr key={key} className="border-t border-foreground/10">
                  <td className="py-2 pr-3 font-semibold text-foreground">{label}</td>
                  {teams.map((t) => {
                    const filled = teamHasField(players, submissions, t.id, key);
                    return (
                      <td key={t.id} className="py-2 px-2 text-center">
                        <span
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                            filled ? "bg-success/20 text-success" : "bg-foreground/10 text-foreground/45"
                          }`}
                          aria-label={`${t.name} ${label}: ${filled ? "filled" : "empty"}`}
                        >
                          {filled ? "✓" : "—"}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

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
