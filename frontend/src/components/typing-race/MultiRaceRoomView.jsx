"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "../../lib/context/UserContext.jsx";
import { useTypingRace } from "../../lib/typing-race/TypingRaceSocketContext.jsx";
import { Button } from "../Button.jsx";
import { MultiRaceCountdown } from "./MultiRaceCountdown.jsx";
import { MultiRaceTrack } from "./MultiRaceTrack.jsx";
import { MultiRaceTyping } from "./MultiRaceTyping.jsx";

/**
 * @param {{ roomCode: string }} props
 */
export function MultiRaceRoomView({ roomCode }) {
  const router = useRouter();
  const { user } = useUser();
  const {
    room,
    connected,
    isConnecting,
    socketError,
    joinRoom,
    leaveRoom,
    setReady,
    startCountdown,
    finishRace,
    forceEnd,
    resetLobby,
    serverNow,
    typingRaceUserFacingError,
  } = useTypingRace();
  const [joinErr, setJoinErr] = useState(/** @type {string | null} */ (null));
  const [busy, setBusy] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

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
  }, [connected, roomCode, room?.roomCode, joinRoom, room, typingRaceUserFacingError]);

  const phase = typeof room?.phase === "string" ? room.phase : "lobby";
  const players = Array.isArray(room?.players) ? room.players : [];
  const selfId = user?.id ?? "";
  const isHost = room?.hostUserId === selfId;
  const rc = room?.raceConfig;
  const selfPlayer = players.find((p) => p.userId === selfId);
  const selfFinished = selfPlayer?.finishedAtMs != null;

  const sortedResults = useMemo(() => {
    return [...players].sort((a, b) => {
      const ka = a.rank != null ? a.rank : a.finishedAtMs != null ? 500 : 999;
      const kb = b.rank != null ? b.rank : b.finishedAtMs != null ? 500 : 999;
      return ka - kb;
    });
  }, [players]);

  const onTypingDone = useCallback(async () => {
    await finishRace();
  }, [finishRace]);

  const copyRoomCode = useCallback(() => {
    navigator.clipboard?.writeText(roomCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }, [roomCode]);

  /* ---------- loading / error states ---------- */

  if (!connected && !joinErr) {
    return (
      <div className="multi-phase-enter mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center text-[var(--tt-ink-muted)]">
        {socketError ? (
          <>
            <p className="text-red-400">{socketError}</p>
            <Button type="button" className="mt-6" onClick={() => router.push("/games/typing-race/multi")}>
              Back
            </Button>
          </>
        ) : (
          <>
            <div className="multi-spinner mx-auto mb-4" />
            <p>Connecting to server&hellip;</p>
          </>
        )}
      </div>
    );
  }

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

  if (!room || room.roomCode !== roomCode) {
    return (
      <div className="multi-phase-enter mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center text-[var(--tt-ink-muted)]">
        <div className="multi-spinner mx-auto mb-4" />
        <p>Joining room&hellip;</p>
      </div>
    );
  }

  /* ---------- main render ---------- */

  return (
    <div className="multi-phase-enter mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      {/* Header bar — always visible */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="multi-room-code-badge"
            onClick={copyRoomCode}
            title="Copy room code"
          >
            <span className="multi-room-code-label">Room</span>
            <span className="multi-room-code-digits">{roomCode}</span>
            <span className="multi-room-code-copy">{codeCopied ? "\u2713" : "\u2398"}</span>
          </button>
          {codeCopied && (
            <span className="text-xs font-medium text-[var(--tt-accent)] multi-phase-enter">Copied!</span>
          )}
        </div>
        <button
          type="button"
          className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--tt-ink-muted)] transition hover:bg-[var(--tt-bg-elevated)] hover:text-[var(--tt-ink)]"
          onClick={() => {
            void leaveRoom();
            router.push("/games/typing-race/multi");
          }}
        >
          Leave
        </button>
      </div>

      {/* ====== LOBBY ====== */}
      {phase === "lobby" && (
        <div className="multi-phase-enter mt-6 space-y-6">
          <div className="text-center">
            <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--tt-ink-muted)]">
              Waiting for players
            </p>
            <p className="mt-1 text-xs text-[var(--tt-ink-faint)]">
              Share the room code to invite friends
            </p>
          </div>

          <ul className="space-y-2">
            {players.map((p) => (
              <li
                key={p.userId}
                className="multi-player-card"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className="multi-player-dot"
                    style={{ backgroundColor: p.color }}
                  />
                  <span className="font-medium text-[var(--tt-ink)]" style={{ color: p.color }}>
                    {p.displayName}
                  </span>
                  {p.userId === room.hostUserId && (
                    <span className="multi-badge multi-badge--host">host</span>
                  )}
                </div>
                <span className={`multi-badge ${p.ready ? "multi-badge--ready" : "multi-badge--waiting"}`}>
                  {p.ready ? "Ready" : "Not ready"}
                </span>
              </li>
            ))}
          </ul>

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

      {/* ====== COUNTDOWN ====== */}
      {phase === "countdown" && room.raceStartAtMs != null && (
        <div className="multi-phase-enter">
          <MultiRaceCountdown
            raceStartAtMs={room.raceStartAtMs}
            serverNow={serverNow}
          />
        </div>
      )}

      {/* ====== RACING ====== */}
      {phase === "racing" && rc && (
        <div className="multi-phase-enter mt-4">
          <MultiRaceTrack players={players} selfId={selfId} />

          {selfFinished ? (
            <div className="multi-phase-enter mt-6">
              <SelfFinishCard player={selfPlayer} />
              <WaitingForOthers players={players} />
            </div>
          ) : (
            <MultiRaceTyping
              raceConfig={rc}
              isRacing
              onDone={onTypingDone}
              peerCursors={players.filter((p) => p.userId !== selfId)}
            />
          )}

          {isHost && (
            <div className="mt-4 text-center">
              <button
                type="button"
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

      {/* ====== FINISHED / RESULTS ====== */}
      {phase === "finished" && (
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

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {isHost && (
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await resetLobby();
                  setBusy(false);
                }}
              >
                Play again
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={() => router.push("/games/typing-race/multi")}>
              Back to lobby
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Sub-components ---------- */

function SelfFinishCard({ player }) {
  if (!player) return null;
  return (
    <div className="multi-finish-card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--tt-accent)]">
            Finished!
          </p>
          <p className="mt-1 font-sans text-lg font-bold text-[var(--tt-ink-strong)]">
            #{player.rank ?? "?"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-right">
          <StatMini label="WPM" value={Math.round(player.wpm ?? 0)} highlight />
          <StatMini label="Errors" value={player.errorLen ?? 0} />
        </div>
      </div>
    </div>
  );
}

function WaitingForOthers({ players }) {
  const still = players.filter((p) => p.finishedAtMs == null);
  const done = players.filter((p) => p.finishedAtMs != null);
  if (still.length === 0) return null;

  return (
    <div className="mt-4 rounded-[var(--tt-radius-md)] border border-[var(--tt-ink-muted)]/10 bg-[var(--tt-bg-elevated)]/60 px-4 py-3">
      <p className="text-xs font-medium text-[var(--tt-ink-muted)]">
        Waiting for {still.length} player{still.length > 1 ? "s" : ""}&hellip;
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {done.map((p) => (
          <span key={p.userId} className="multi-badge multi-badge--ready" style={{ borderColor: p.color }}>
            {p.displayName} #{p.rank}
          </span>
        ))}
        {still.map((p) => (
          <span key={p.userId} className="multi-badge multi-badge--waiting">
            {p.displayName} {Math.round((p.progress01 ?? 0) * 100)}%
          </span>
        ))}
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
        <span
          className="multi-player-dot"
          style={{ backgroundColor: p.color }}
        />
        <span className="font-medium text-[var(--tt-ink)]">
          {p.displayName}
          {isSelf && <span className="ml-1.5 text-[10px] text-[var(--tt-ink-muted)]">(you)</span>}
        </span>
      </div>
      <div className="flex items-center gap-4 text-right">
        <StatMini label="WPM" value={Math.round(p.wpm ?? 0)} highlight />
        <StatMini label="Errors" value={p.errorLen ?? 0} />
        {elapsed != null && (
          <StatMini label="Time" value={`${elapsed.toFixed(1)}s`} />
        )}
      </div>
    </div>
  );
}

function StatMini({ label, value, highlight }) {
  return (
    <div className="min-w-[3rem]">
      <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-[var(--tt-ink-faint)]">{label}</p>
      <p className={`font-mono text-sm tabular-nums leading-tight ${highlight ? "text-[var(--tt-ink-strong)]" : "text-[var(--tt-ink)]"}`}>
        {value}
      </p>
    </div>
  );
}
