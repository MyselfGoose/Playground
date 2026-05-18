"use client";

import { AnimatePresence } from "framer-motion";
import { motion } from "framer-motion";
import { Button } from "../../../../components/Button.jsx";
import { HangmanShell } from "../components/HangmanShell.jsx";
import { LobbyCountdownOverlay } from "../components/LobbyCountdownOverlay.jsx";
import { PlayerRoster } from "../components/PlayerRoster.jsx";
import { RoomCodeChip } from "../components/RoomCodeChip.jsx";
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

      <div className="mx-auto flex w-full max-w-lg flex-col gap-6 px-4 py-8 pb-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-foreground/55">Lobby</p>
            {room?.code ? <RoomCodeChip code={room.code} className="mt-3 w-full" /> : null}
          </div>
          <Button variant="ghost" onClick={() => void leaveToMenu()}>
            Leave
          </Button>
        </header>

        {(error || socketError) && (
          <p className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            {error || socketError}
          </p>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl bg-muted-bright/25 px-4 py-3 text-center"
        >
          <p className="text-sm font-bold text-foreground">
            {needMore
              ? `Waiting for players (${connectedCount}/${minPlayers} minimum)`
              : `${readyCount} of ${connectedCount} ready`}
          </p>
          <p className="mt-1 text-xs font-semibold text-foreground/55">
            {needMore
              ? "Share the room code so friends can join."
              : "Everyone ready starts a 5 second countdown."}
          </p>
        </motion.div>

        <PlayerRoster
          players={room?.players ?? []}
          hostId={room?.hostId ?? ""}
          localUserId={localUserId}
        />

        <Button
          variant={isReady ? "secondary" : "primary"}
          className="w-full rounded-full py-3.5 text-base font-black"
          disabled={!connected || !permissions.canSetReady || needMore}
          onClick={() => void setReady(!isReady)}
        >
          {isReady ? "Unready" : "Ready up"}
        </Button>
      </div>
    </HangmanShell>
  );
}
