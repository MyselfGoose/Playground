"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "../../../components/Button.jsx";

const ACTIVE_GAME = new Set(["STARTING", "IN_ROUND", "BETWEEN_ROUNDS"]);

/**
 * @param {{
 *   room: Record<string, unknown> | null,
 *   localUserId: string | null,
 *   proposeEarlyFinish: () => Promise<{ ok: boolean, error?: { message?: string } }>,
 *   voteEarlyFinish: (accept: boolean) => Promise<{ ok: boolean, error?: { message?: string } }>,
 * }} props
 */
export function EarlyFinishVote({ room, localUserId, proposeEarlyFinish, voteEarlyFinish }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(/** @type {string | null} */ (null));

  const state = typeof room?.state === "string" ? room.state : "";
  const visible = ACTIVE_GAME.has(state);
  const ef = room?.earlyFinish;

  const connectedPlayers = useMemo(() => {
    const pl = room?.players;
    if (!Array.isArray(pl)) return [];
    return pl.filter((p) => p?.connected);
  }, [room?.players]);

  const propose = useCallback(async () => {
    setErr(null);
    setBusy(true);
    const r = await proposeEarlyFinish();
    setBusy(false);
    if (!r.ok) setErr(r.error?.message ?? "Could not start vote");
  }, [proposeEarlyFinish]);

  const vote = useCallback(
    async (accept) => {
      setErr(null);
      setBusy(true);
      const r = await voteEarlyFinish(accept);
      setBusy(false);
      if (!r.ok) setErr(r.error?.message ?? "Could not record vote");
    },
    [voteEarlyFinish],
  );

  if (!visible) return null;

  const votes = ef && typeof ef.votes === "object" && ef.votes ? /** @type {Record<string, string>} */ (ef.votes) : {};
  const proposedBy = typeof ef?.proposedBy === "string" ? ef.proposedBy : null;
  const proposerName =
    proposedBy && Array.isArray(room?.players)
      ? room.players.find((p) => p.userId === proposedBy)?.username ?? "A player"
      : "A player";

  const imConnected = Boolean(
    localUserId && connectedPlayers.some((p) => p.userId === localUserId),
  );

  return (
    <section className="rounded-[var(--radius-2xl)] border-2 border-ink/10 bg-white/90 p-5 shadow-[var(--shadow-card)] ring-2 ring-white/80">
      <h2 className="text-lg font-extrabold text-ink">End game early</h2>
      <p className="mt-1 text-sm text-ink-muted">
        Anyone can propose finishing now. Every connected player must vote <span className="font-bold text-ink">yes</span>{" "}
        to jump to results. One <span className="font-bold text-ink">no</span> cancels the vote.
      </p>

      {ef ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm font-semibold text-ink">
            <span className="text-accent">{proposerName}</span> wants to end the game and see results now.
          </p>
          <ul className="flex flex-col gap-2 rounded-2xl bg-ink/[0.03] p-3">
            {connectedPlayers.map((p) => {
              const v = votes[p.userId];
              const label =
                v === "yes" ? "✓ Yes" : v === "no" ? "✗ No" : "… Waiting";
              return (
                <li
                  key={p.userId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm font-bold text-ink"
                >
                  <span>
                    {p.username}
                    {p.userId === localUserId ? (
                      <span className="ml-2 text-xs font-bold uppercase text-ink-muted">You</span>
                    ) : null}
                  </span>
                  <span
                    className={
                      v === "yes"
                        ? "text-emerald-700"
                        : v === "no"
                          ? "text-red-700"
                          : "text-ink-muted"
                    }
                  >
                    {label}
                  </span>
                </li>
              );
            })}
          </ul>

          {imConnected ? (
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="primary" disabled={busy} onClick={() => void vote(true)}>
                Vote yes
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void vote(false)}>
                Vote no
              </Button>
            </div>
          ) : (
            <p className="text-sm font-semibold text-ink-muted">Reconnect to cast your vote.</p>
          )}
        </div>
      ) : (
        <div className="mt-4">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void propose()}>
            {busy ? "Starting vote…" : "Propose ending game now"}
          </Button>
        </div>
      )}

      {err ? <p className="mt-3 text-sm font-semibold text-red-700">{err}</p> : null}
    </section>
  );
}
