"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { CountdownStrip } from "../../../../components/game-feel/CountdownStrip.jsx";
import { PartyLobby } from "../../../../components/party/PartyLobby.jsx";
import { HangmanShell } from "../components/HangmanShell.jsx";
import { useHangmanActions } from "../hooks/useHangmanActions.js";
import { useHangmanRoom } from "../hooks/useHangmanRoom.js";

export function HangmanLobbyScreen() {
  const {
    room,
    connected,
    connectionState,
    socketError,
    isSyncing,
    countdownActive,
    countdownSeconds,
    readyCount,
    connectedCount,
    localUserId,
    permissions,
    lastScores,
  } = useHangmanRoom("lobby");
  const { error, setReady, leaveToMenu } = useHangmanActions();
  const [showCountdownStrip, setShowCountdownStrip] = useState(false);
  const wasCountdownRef = useRef(false);

  useEffect(() => {
    if (countdownActive && !wasCountdownRef.current) {
      wasCountdownRef.current = true;
      setShowCountdownStrip(true);
    }
    if (!countdownActive) {
      wasCountdownRef.current = false;
      setShowCountdownStrip(false);
    }
  }, [countdownActive]);

  const me = room?.players?.find((p) => p.userId === localUserId);
  const isReady = Boolean(me?.ready);
  const minPlayers = 2;
  const needMore = connectedCount < minPlayers;

  const players = useMemo(
    () =>
      (room?.players ?? []).map((p) => ({
        id: p.userId,
        name: p.username,
        ready: Boolean(p.ready),
        connected: p.connected !== false,
        presenceStatus: p.presenceStatus,
        graceEndsAtMs: p.graceEndsAtMs,
        graceSecondsRemaining: p.graceSecondsRemaining,
        isHost: p.userId === room?.hostId,
      })),
    [room?.players, room?.hostId],
  );

  const statusLine = needMore
    ? `Waiting for players (${connectedCount}/${minPlayers} minimum)`
    : `${readyCount} of ${connectedCount} ready`;

  const startRules = needMore
    ? "Share the room code or invite link so friends can join."
    : "Everyone ready starts a 5 second countdown.";

  return (
    <HangmanShell>
      <AnimatePresence>
        {countdownActive && showCountdownStrip ? (
          <CountdownStrip
            label="Get ready to play Hangman"
            onComplete={() => setShowCountdownStrip(false)}
          />
        ) : null}
      </AnimatePresence>

      {lastScores && Object.keys(lastScores).length > 0 ? (
        <p className="mx-auto mb-4 max-w-lg rounded-xl border border-muted-bright/50 bg-muted-bright/20 px-4 py-3 text-center text-sm font-semibold text-foreground/70">
          Previous game scores saved — ready up to start a new match.
        </p>
      ) : null}

      <PartyLobby
        gameSlug="hangman"
        code={room?.code}
        header={{ eyebrow: "Lobby" }}
        players={players}
        localUserId={localUserId}
        startPolicy="countdown"
        startRules={startRules}
        statusLine={statusLine}
        minPlayers={minPlayers}
        connectedCount={connectedCount}
        readyCount={readyCount}
        ready={isReady}
        onReadyToggle={() => void setReady(!isReady)}
        readyDisabled={!connected || !permissions.canSetReady || needMore}
        onLeave={() => void leaveToMenu()}
        error={error || socketError}
      />
    </HangmanShell>
  );
}
