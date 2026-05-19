"use client";

import { useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import { PartyLobby } from "../../../../components/party/PartyLobby.jsx";
import { HangmanShell } from "../components/HangmanShell.jsx";
import { LobbyCountdownOverlay } from "../components/LobbyCountdownOverlay.jsx";
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
  } = useHangmanRoom("lobby");
  const { error, setReady, leaveToMenu } = useHangmanActions();

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
    <HangmanShell
      connected={connected}
      connectionState={connectionState}
      socketError={socketError}
      isSyncing={isSyncing}
    >
      <AnimatePresence>
        {countdownActive ? <LobbyCountdownOverlay seconds={countdownSeconds} /> : null}
      </AnimatePresence>

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
