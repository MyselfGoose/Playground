"use client";

import { useCallback, useMemo, useState } from "react";

const ACTIVE_GAME = new Set(["STARTING", "IN_ROUND", "BETWEEN_ROUNDS"]);

const btnBase =
  "rounded-xl px-3 py-1.5 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50";

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
      ? room.players.find((p) => p.userId === proposedBy)?.username ?? "Player"
      : "Player";

  const imConnected = Boolean(
    localUserId && connectedPlayers.some((p) => p.userId === localUserId),
  );

  const imProposer = Boolean(proposedBy && localUserId && proposedBy === localUserId);

  const agreed = Object.values(votes).filter((v) => v === "yes").length;
  const total = connectedPlayers.length;

  if (!ef) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <button
          type="button"
          disabled={busy}
          onClick={() => void propose()}
          title="Ask everyone to end the game after this round (unanimous vote)"
          className={`${btnBase} border border-red-300/80 bg-white/90 text-red-700 shadow-sm hover:bg-red-50 focus-visible:outline-red-500`}
        >
          {busy ? "…" : "End Early?"}
        </button>
        {err ? (
          <span className="max-w-[12rem] text-right text-[11px] font-semibold leading-tight text-red-600">{err}</span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1 text-right">
      <span className="text-[11px] font-semibold leading-tight text-ink-muted">
        {proposerName} · end after this round · {agreed}/{total} yes
      </span>
      {imConnected ? (
        imProposer ? (
          <span className="text-[11px] font-bold text-emerald-700">You agreed — waiting for others</span>
        ) : (
          <div className="flex flex-wrap justify-end gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void vote(true)}
              className={`${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:outline-emerald-600`}
            >
              Agree
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void vote(false)}
              className={`${btnBase} border border-ink/15 bg-white/90 text-ink hover:bg-ink/[0.04] focus-visible:outline-accent`}
            >
              Decline
            </button>
          </div>
        )
      ) : (
        <span className="text-[11px] text-ink-muted">Reconnect to vote</span>
      )}
      {err ? <span className="max-w-[14rem] text-[11px] font-semibold text-red-600">{err}</span> : null}
    </div>
  );
}
