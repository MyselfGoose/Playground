"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../lib/context/UserContext.jsx";
import { useTypingRace } from "../../lib/typing-race/TypingRaceSocketContext.jsx";
import { Button } from "../Button.jsx";
import { PartyCode } from "../party/PartyCode.jsx";
import { LobbyInviteFriends } from "../party/LobbyInviteFriends.jsx";
import { ResultGate } from "../game-feel/WinnerBanner.jsx";
import { ResultActions } from "../game/ResultActions.jsx";
import { MultiRaceCountdown } from "./MultiRaceCountdown.jsx";
import { MultiRaceTrack } from "./MultiRaceTrack.jsx";
import { RaceTypingStage } from "./RaceTypingStage.jsx";

/**
 * @param {{ roomCode: string }} props
 */
export function MultiRaceRoomView({ roomCode }) {
  const router = useRouter();
  const { user } = useUser();
  const {
    room,
    connected,
    joinRoom,
    leaveRoom,
    setReady,
    startCountdown,
    finishRace,
    forceEnd,
    resetLobby,
    kickPlayer,
    serverNow,
    typingRaceUserFacingError,
  } = useTypingRace();
  const [joinErr, setJoinErr] = useState(/** @type {string | null} */ (null));
  const [busy, setBusy] = useState(false);
  /** Local snapshot the moment you complete the passage (before server ack). */
  const [raceLocalStats, setRaceLocalStats] = useState(
    /** @type {{ wpm: number; rawWpm: number; accuracy: number; errorCount: number; elapsedSec: number } | null} */ (null),
  );
  const [frozenEngine, setFrozenEngine] = useState(
    /** @type {{ passage: string; cursor: number; errorStack: string } | null} */ (null),
  );
  const [finishErr, setFinishErr] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    if (!connected) {
      return undefined;
    }
    let cancelled = false;
    const digits = String(roomCode ?? "").replace(/\D/g, "");

    (async () => {
      setJoinErr(null);
      if (digits.length !== 6) {
        if (!cancelled) {
          setJoinErr("Invalid room code");
        }
        return;
      }
      if (room?.roomCode === digits) {
        return;
      }

      const attemptJoin = async (isRetry) => {
        const r = await joinRoom(digits);
        if (cancelled) {
          return;
        }
        if (r.ok) {
          setJoinErr(null);
          return;
        }
        const errCode = /** @type {any} */ (r.error)?.code;
        // BUG-007 / multi-replica: one retry until sticky sessions or shared room store (see backend EVENTS.md).
        if (errCode === "ROOM_NOT_FOUND" && !isRetry) {
          await new Promise((resolve) => setTimeout(resolve, 450));
          if (!cancelled) {
            await attemptJoin(true);
          }
          return;
        }
        setJoinErr(typingRaceUserFacingError(r.error));
      };

      await attemptJoin(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [connected, roomCode, room?.roomCode, joinRoom, typingRaceUserFacingError]);

  const phase = typeof room?.phase === "string" ? room.phase : "lobby";
  const players = Array.isArray(room?.players) ? room.players : [];
  const selfId = user?.id ?? "";
  const isHost = room?.hostUserId === selfId;
  const rc = room?.raceConfig;
  const selfPlayer = players.find((p) => p.userId === selfId);
  const selfFinished = selfPlayer?.finishedAtMs != null;
  const displayCode = String(roomCode ?? "").replace(/\D/g, "");

  useEffect(() => {
    if (phase !== "racing") {
      setRaceLocalStats(null);
      setFrozenEngine(null);
      setFinishErr(null);
    }
  }, [phase]);

  const spectate =
    phase === "racing" && (selfFinished || raceLocalStats != null);

  const sortedResults = useMemo(() => {
    return [...players].sort((a, b) => {
      const ka = a.rank != null ? a.rank : a.finishedAtMs != null ? 500 : 999;
      const kb = b.rank != null ? b.rank : b.finishedAtMs != null ? 500 : 999;
      return ka - kb;
    });
  }, [players]);

  const onRaceComplete = useCallback(
    async (localStats, engineSnap) => {
      if (localStats) {
        setRaceLocalStats(localStats);
      }
      if (engineSnap) {
        setFrozenEngine(engineSnap);
      }
      const statsPayload = localStats
        ? {
            correctChars: localStats.correctChars ?? 0,
            incorrectChars: localStats.incorrectChars ?? 0,
            extraChars: localStats.extraChars ?? 0,
            wpm: localStats.wpm,
            rawWpm: localStats.rawWpm,
            elapsedMs: Math.round(localStats.elapsedSec * 1000),
          }
        : undefined;

      const FINISH_RETRY_MS = 120;
      const FINISH_MAX_ATTEMPTS = 4;
      let lastResult = /** @type {{ ok: boolean; error?: { code?: string; message?: string } } | null} */ (
        null
      );
      for (let attempt = 0; attempt < FINISH_MAX_ATTEMPTS; attempt += 1) {
        lastResult = await finishRace(statsPayload);
        if (lastResult.ok) {
          setFinishErr(null);
          return;
        }
        if (/** @type {any} */ (lastResult.error)?.code !== "NOT_DONE") {
          break;
        }
        await new Promise((r) => setTimeout(r, FINISH_RETRY_MS));
      }
      if (lastResult && !lastResult.ok) {
        setFinishErr(typingRaceUserFacingError(lastResult.error));
      }
    },
    [finishRace, typingRaceUserFacingError],
  );

  const handleKick = useCallback(
    async (targetUserId) => {
      if (!window.confirm("Remove this player from the room?")) {
        return;
      }
      setBusy(true);
      const r = await kickPlayer(targetUserId);
      setBusy(false);
      if (!r.ok) {
        alert(typingRaceUserFacingError(r.error));
      }
    },
    [kickPlayer, typingRaceUserFacingError],
  );

  /* ---------- loading / error states ---------- */

  if (joinErr) {
    return (
      <div className="multi-phase-enter mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className="text-red-400">{joinErr}</p>
        <Button type="button" className="mt-6" onClick={() => router.push("/games/typing-race/multi")}>
          Back
        </Button>
      </div>
    );
  }

  if (!room || String(room.roomCode).replace(/\D/g, "") !== displayCode) {
    return (
      <div
        className="multi-phase-enter mx-auto w-full max-w-2xl flex-1 px-4 py-16"
        aria-busy="true"
        aria-label="Joining room"
      >
        <div className="multi-spinner mx-auto" aria-hidden />
      </div>
    );
  }

  /* ---------- main render ---------- */

  return (
    <div className="multi-phase-enter mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <PartyCode code={displayCode} gameSlug="typing-race" size="sm" />
        <button
          type="button"
          data-no-refocus
          className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--tt-ink-muted)] transition hover:bg-[var(--tt-bg-elevated)] hover:text-[var(--tt-ink)]"
          onClick={() => {
            void leaveRoom();
            router.push("/games/typing-race/multi");
          }}
        >
          Leave
        </button>
      </div>

      {phase === "lobby" && (
        <div className="multi-phase-enter mt-6 space-y-6">
          <div className="text-center">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--tt-ink-muted)]">
              Waiting for players
            </p>
            <p className="mt-1 text-xs text-[var(--tt-ink-faint)]">
              Share the invite link or room code
            </p>
          </div>

          <ul className="space-y-2">
            {players.map((p) => (
              <li key={p.userId} className="multi-player-card">
                <div className="flex items-center gap-2.5">
                  <span className="multi-player-dot" style={{ backgroundColor: p.color }} />
                  <span className="font-medium text-[var(--tt-ink)]" style={{ color: p.color }}>
                    {p.displayName}
                  </span>
                  {p.userId === room.hostUserId && (
                    <span className="multi-badge multi-badge--host">host</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`multi-badge ${p.ready ? "multi-badge--ready" : "multi-badge--waiting"}`}>
                    {p.ready ? "Ready" : "Not ready"}
                  </span>
                  {isHost && p.userId !== selfId && (
                    <button
                      type="button"
                      data-no-refocus
                      className="rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-400/90 hover:bg-red-500/10 hover:text-red-300"
                      disabled={busy}
                      onClick={() => void handleKick(p.userId)}
                    >
                      Kick
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {isHost && displayCode ? (
            <LobbyInviteFriends
              gameSlug="typing-race"
              roomCode={displayCode}
              hostId={room?.hostUserId ?? selfId}
              localUserId={selfId}
              playerUserIds={players.map((p) => p.userId)}
            />
          ) : null}

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!connected || busy}
              onClick={async () => {
                setBusy(true);
                const me = players.find((p) => p.userId === selfId);
                await setReady(!me?.ready);
                setBusy(false);
              }}
            >
              {selfPlayer?.ready ? "Unready" : "Ready up"}
            </Button>
            {isHost && (
              <Button
                type="button"
                disabled={!connected || busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await startCountdown();
                  setBusy(false);
                  if (!r.ok) {
                    alert(r.error?.message ?? "Cannot start");
                  }
                }}
              >
                Start race
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === "countdown" && room.raceStartAtMs != null && (
        <div className="multi-phase-enter">
          <MultiRaceCountdown raceStartAtMs={room.raceStartAtMs} serverNow={serverNow} />
        </div>
      )}

      {phase === "racing" && rc && (
        <div className="multi-phase-enter mt-4 typing-race-root typing-race-root--active">
          <div aria-live="polite" className="sr-only">
            {spectate ? "You finished the race. Spectating other players." : "Race in progress."}
          </div>
          <MultiRaceTrack players={players} selfId={selfId} />

          {finishErr && (
            <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">
              {finishErr} — still syncing with server…
            </p>
          )}

          <RaceTypingStage
            raceConfig={rc}
            isRacing
            spectate={spectate}
            frozenEngine={frozenEngine}
            onDone={onRaceComplete}
            peerCursors={players.filter((p) => p.userId !== selfId)}
            sidebar={
              spectate ? (
                <>
                  <SelfFinishCard
                    player={selfPlayer}
                    localStats={raceLocalStats}
                    raceStartAtMs={room.raceStartAtMs}
                  />
                  <WaitingForOthers players={players} selfId={selfId} compact />
                </>
              ) : null
            }
          />

          {isHost && (
            <div className="mt-4 text-center">
              <button
                type="button"
                data-no-refocus
                className="text-xs text-[var(--tt-ink-faint)] underline-offset-2 hover:underline hover:text-[var(--tt-ink-muted)]"
                onClick={async () => {
                  setBusy(true);
                  await forceEnd();
                  setBusy(false);
                }}
              >
                Force end race
              </button>
            </div>
          )}
        </div>
      )}

      {phase === "finished" && (
        <ResultGate
          displayMs={1200}
          title={
            sortedResults.find((p) => p.rank === 1)?.displayName
              ? `${sortedResults.find((p) => p.rank === 1)?.displayName} wins the race!`
              : "Race complete"
          }
          subtitle="Fastest fingers take the crown."
        >
        <div className="multi-phase-enter mt-6">
          <div className="text-center">
            <p className="font-sans text-xs font-bold uppercase tracking-[0.2em] text-[var(--tt-accent)]">
              Race complete
            </p>
            <h2 className="mt-2 font-sans text-2xl font-bold text-[var(--tt-ink-strong)]">
              Results
            </h2>
          </div>

          <div className="mt-8 space-y-3">
            {sortedResults.map((p, i) => (
              <ResultCard
                key={p.userId}
                player={p}
                position={i}
                isSelf={p.userId === selfId}
                isWinner={p.rank === 1}
                raceStartAtMs={room.raceStartAtMs}
              />
            ))}
          </div>

          {!isHost && (
            <p className="mt-6 text-center text-sm text-[var(--tt-ink-muted)]">
              Waiting for host to start another race
            </p>
          )}

          <ResultActions
            className="mt-8"
            linkClassName="text-[var(--tt-accent)] hover:underline"
            playAgainLabel={isHost ? "Run it back" : undefined}
            onPlayAgain={
              isHost
                ? async () => {
                    setBusy(true);
                    const r = await resetLobby();
                    setBusy(false);
                    if (!r.ok) {
                      alert(typingRaceUserFacingError(r.error));
                    }
                  }
                : undefined
            }
            playAgainDisabled={busy}
            secondaryHref={isHost ? "/games/typing-race/multi" : undefined}
            secondaryLabel={isHost ? "Leave room" : undefined}
          />
        </div>
        </ResultGate>
      )}
    </div>
  );
}

function SelfFinishCard({ player, localStats, raceStartAtMs }) {
  if (!player && !localStats) return null;
  const fmt1 = (n) => (Number.isFinite(n) ? (Math.round(n * 10) / 10).toFixed(1) : "0.0");
  const wpm = localStats ? Math.round(localStats.wpm) : Math.round(player?.wpm ?? 0);
  const rawWpm = localStats ? Math.round(localStats.rawWpm) : null;
  const acc = localStats ? fmt1(localStats.accuracy) : null;
  const errs = localStats ? localStats.errorCount : (player?.errorLen ?? 0);
  const timeFromServer =
    player?.finishedAtMs != null && typeof raceStartAtMs === "number"
      ? Math.max(0, (player.finishedAtMs - raceStartAtMs) / 1000)
      : null;
  const timeLocal = localStats?.elapsedSec != null ? Number(localStats.elapsedSec.toFixed(1)) : null;

  return (
    <div className="multi-finish-card">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--tt-accent)]">
            You finished!
          </p>
          <p className="mt-1 font-sans text-lg font-bold text-[var(--tt-ink-strong)]">
            {player?.rank != null ? `Place #${player.rank}` : "Finishing up\u2026"}
          </p>
          <p className="mt-1 text-xs text-[var(--tt-ink-muted)]">
            Final rank updates when the server confirms your run.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-5 gap-y-3 text-right sm:grid-cols-3">
          <StatMini label="WPM" value={String(wpm)} highlight />
          {rawWpm != null ? <StatMini label="Raw" value={String(rawWpm)} /> : null}
          {acc != null ? <StatMini label="Accuracy" value={`${acc}%`} /> : null}
          <StatMini label="Errors" value={String(errs)} />
          {(timeFromServer != null || timeLocal != null) && (
            <StatMini
              label="Time"
              value={timeFromServer != null ? `${timeFromServer.toFixed(1)}s` : `${timeLocal}s`}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function WaitingForOthers({ players, selfId, compact = false }) {
  const still = players.filter((p) => p.finishedAtMs == null);
  const done = players.filter((p) => p.finishedAtMs != null);
  if (still.length === 0) return null;

  return (
    <div
      className={`${compact ? "" : "mt-4"} rounded-[var(--tt-radius-md)] border border-[var(--tt-ink-muted)]/10 bg-[var(--tt-bg-elevated)]/60 px-4 py-3`}
    >
      <p className="text-xs font-medium text-[var(--tt-ink-muted)]">
        Waiting for {still.length} other player{still.length > 1 ? "s" : ""} to finish&hellip;
      </p>
      <div className="mt-3 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tt-ink-faint)]">Done</p>
        <div className="flex flex-wrap gap-2">
          {done.map((p) => (
            <span key={p.userId} className="multi-badge multi-badge--ready" style={{ borderColor: p.color }}>
              {p.displayName}
              {p.userId === selfId ? " (you)" : ""}
              {p.rank != null ? ` · #${p.rank}` : ""}
            </span>
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tt-ink-faint)]">Still typing</p>
        <div className="flex flex-wrap gap-2">
          {still.map((p) => (
            <span key={p.userId} className="multi-badge multi-badge--waiting">
              {p.displayName} · {Math.round((p.progress01 ?? 0) * 100)}%
              {typeof p.wpm === "number" && p.wpm > 0 ? ` · ${Math.round(p.wpm)} wpm` : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ResultCard({ player, position, isSelf, isWinner, raceStartAtMs }) {
  const p = player;
  const isDnf = p.finishedAtMs != null && p.rank == null;
  const elapsed = p.finishedAtMs && raceStartAtMs
    ? Math.max(0, (p.finishedAtMs - raceStartAtMs) / 1000)
    : null;

  return (
    <div className={`multi-result-card ${isWinner ? "multi-result-card--winner" : ""} ${isSelf ? "multi-result-card--self" : ""}`}>
      <div className="flex items-center gap-3">
        <span className={`multi-result-rank ${isWinner ? "multi-result-rank--gold" : ""}`}>
          {isDnf ? "DNF" : p.rank != null ? `#${p.rank}` : "\u2014"}
        </span>
        <span className="multi-player-dot" style={{ backgroundColor: p.color }} />
        <span className="font-medium text-[var(--tt-ink)]">
          {p.displayName}
          {isSelf && <span className="ml-1.5 text-[10px] text-[var(--tt-ink-muted)]">(you)</span>}
        </span>
      </div>
      <div className="flex items-center gap-4 text-right">
        <StatMini label="WPM" value={Math.round(p.wpm ?? 0)} highlight />
        <StatMini label="Errors" value={p.errorLen ?? 0} />
        {elapsed != null && <StatMini label="Time" value={`${elapsed.toFixed(1)}s`} />}
      </div>
    </div>
  );
}

function StatMini({ label, value, highlight }) {
  return (
    <div className="min-w-[3rem]">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--tt-ink-faint)]">{label}</p>
      <p
        className={`font-mono text-sm tabular-nums leading-tight ${highlight ? "text-[var(--tt-ink-strong)]" : "text-[var(--tt-ink)]"}`}
      >
        {value}
      </p>
    </div>
  );
}
