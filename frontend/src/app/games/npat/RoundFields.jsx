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
 * @param {{
 *   canSubmit: boolean,
 *   mine: Record<string, string>,
 *   onSubmit: (field: string, value: string) => void,
 * }} props
 */
export function RoundFields({ canSubmit, mine, onSubmit }) {
  const [drafts, setDrafts] = useState(() => ({ name: "", place: "", animal: "", thing: "" }));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FIELDS.map(({ key, label }) => {
        const filled = Boolean(mine[key]?.trim());
        return (
          <div
            key={key}
            className="flex flex-col gap-2 rounded-[var(--radius-xl)] bg-white/85 p-4 shadow-[var(--shadow-card)] ring-2 ring-white/80"
          >
            <span className="text-sm font-extrabold uppercase tracking-wide text-ink-muted">{label}</span>
            <input
              value={drafts[key]}
              disabled={!canSubmit || filled}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              className="w-full rounded-2xl border-2 border-ink/10 bg-white px-3 py-2 text-ink outline-none focus:border-accent/40 disabled:bg-ink/5"
              placeholder="Your answer…"
            />
            <Button
              type="button"
              variant={filled ? "secondary" : "primary"}
              className="w-full"
              disabled={!canSubmit || filled || !drafts[key].trim()}
              onClick={() => {
                onSubmit(key, drafts[key].trim());
              }}
            >
              {filled ? "Saved" : "Submit"}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
