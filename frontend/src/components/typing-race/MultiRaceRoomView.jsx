"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
    joinRoom,
    leaveRoom,
    setReady,
    startCountdown,
    finishRace,
    resetLobby,
    serverNow,
  } = useTypingRace();
  const [joinErr, setJoinErr] = useState(/** @type {string | null} */ (null));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!roomCode) {
        return;
      }
      if (room?.roomCode === roomCode) {
        return;
      }
      const r = await joinRoom(roomCode);
      if (cancelled) {
        return;
      }
      if (!r.ok) {
        setJoinErr(r.error?.message ?? "Could not join");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomCode, room?.roomCode, joinRoom, room]);

  const phase = typeof room?.phase === "string" ? room.phase : "lobby";
  const players = Array.isArray(room?.players) ? room.players : [];
  const selfId = user?.id ?? "";
  const isHost = room?.hostUserId === selfId;
  const rc = room?.raceConfig;

  const onTypingDone = useCallback(async () => {
    await finishRace();
  }, [finishRace]);

  if (joinErr) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className="text-red-400">{joinErr}</p>
        <Button type="button" className="mt-6" onClick={() => router.push("/games/typing-race/multi")}>
          Back
        </Button>
      </div>
    );
  }

  if (!room || room.roomCode !== roomCode) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center text-[var(--tt-ink-muted)]">
        Joining room…
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm text-[var(--tt-ink-muted)]">Room {roomCode}</p>
        <div className="flex gap-2">
          <button
            type="button"
            className="text-xs text-[var(--tt-accent)] underline-offset-2 hover:underline"
            onClick={() => {
              void leaveRoom();
              router.push("/games/typing-race/multi");
            }}
          >
            Leave
          </button>
        </div>
      </div>

      {phase === "lobby" && (
        <div className="mt-8 space-y-6">
          <h2 className="font-sans text-lg font-semibold text-[var(--tt-ink-strong)]">Lobby</h2>
          <ul className="space-y-2">
            {players.map((p) => (
              <li
                key={p.userId}
                className="flex items-center justify-between rounded-lg border border-[var(--tt-ink-muted)]/20 bg-[var(--tt-bg-elevated)]/80 px-3 py-2 text-sm"
              >
                <span style={{ color: p.color }}>{p.displayName}</span>
                <span className="text-[var(--tt-ink-muted)]">
                  {p.userId === room.hostUserId ? "host · " : ""}
                  {p.ready ? "ready" : "not ready"}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                const me = players.find((p) => p.userId === selfId);
                await setReady(!me?.ready);
                setBusy(false);
              }}
            >
              Toggle ready
            </Button>
            {isHost && (
              <Button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const r = await startCountdown();
                  setBusy(false);
                  if (!r.ok) {
                    alert(r.error?.message ?? "Cannot start");
                  }
                }}
              >
                Start countdown
              </Button>
            )}
          </div>
        </div>
      )}

      {phase === "countdown" && room.raceStartAtMs != null && (
        <MultiRaceCountdown
          raceStartAtMs={room.raceStartAtMs}
          serverNow={serverNow}
        />
      )}

      {phase === "racing" && rc && (
        <>
          <MultiRaceTrack players={players} selfId={selfId} />
          <MultiRaceTyping
            raceConfig={rc}
            isRacing
            onDone={onTypingDone}
          />
        </>
      )}

      {phase === "finished" && (
        <div className="mt-8 space-y-4 text-center">
          <h2 className="font-sans text-xl font-bold text-[var(--tt-ink-strong)]">Results</h2>
          <ol className="mx-auto max-w-sm space-y-2 text-left">
            {[...players]
              .sort((a, b) => {
                const ka =
                  a.rank != null ? a.rank : a.finishedAtMs != null ? 500 : 999;
                const kb =
                  b.rank != null ? b.rank : b.finishedAtMs != null ? 500 : 999;
                return ka - kb;
              })
              .map((p) => (
                <li key={p.userId} className="flex justify-between font-mono text-sm">
                  <span>
                    {p.rank != null
                      ? `#${p.rank}`
                      : p.finishedAtMs != null
                        ? "DNF"
                        : "—"}{" "}
                    {p.displayName}
                  </span>
                </li>
              ))}
          </ol>
          <div className="flex flex-wrap justify-center gap-3">
            {isHost && (
              <Button
                type="button"
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
              Lobby
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
