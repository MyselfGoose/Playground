"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { CountdownStrip } from "../../../../components/game-feel/CountdownStrip.jsx";
import { PartyLobby } from "../../../../components/party/PartyLobby.jsx";
import { LobbyInviteFriends } from "../../../../components/party/LobbyInviteFriends.jsx";
import { LoadingSkeleton } from "../../../../components/LoadingSkeleton.jsx";
import { Button } from "../../../../components/Button.jsx";
import { HangmanShell } from "../components/HangmanShell.jsx";
import { useHangmanActions } from "../hooks/useHangmanActions.js";
import { useHangmanRoom } from "../hooks/useHangmanRoom.js";

export function HangmanLobbyScreen() {
  const router = useRouter();
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
    lobbyJoin,
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

  if (!room && lobbyJoin.urlCode) {
    if (lobbyJoin.isJoining || lobbyJoin.joinPhase === "idle") {
      return (
        <HangmanShell>
          <div className="mx-auto w-full max-w-lg px-4 py-8 text-foreground">
            <LoadingSkeleton variant="playfield" />
            <p className="mt-4 text-center font-semibold text-foreground/70">
              Joining lobby {lobbyJoin.urlCode}…
            </p>
          </div>
        </HangmanShell>
      );
    }
    if (lobbyJoin.joinPhase === "failed") {
      return (
        <HangmanShell>
          <div className="mx-auto w-full max-w-lg px-4 py-8 text-center text-foreground">
            <p className="font-semibold text-error">{lobbyJoin.joinError ?? "Could not join room"}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button variant="primary" onClick={lobbyJoin.retryJoin}>
                Try again
              </Button>
              <Button variant="secondary" onClick={() => router.replace("/games/hangman")}>
                Back to Hangman
              </Button>
            </div>
          </div>
        </HangmanShell>
      );
    }
  }

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
        settings={
          room?.code && room?.hostId ? (
            <LobbyInviteFriends
              gameSlug="hangman"
              roomCode={room.code}
              hostId={room.hostId}
              localUserId={localUserId ?? ""}
              playerUserIds={players.map((p) => p.id)}
            />
          ) : null
        }
      />
    </HangmanShell>
  );
}
