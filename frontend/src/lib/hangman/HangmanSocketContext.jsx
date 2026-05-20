"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { useGameSocket } from "../socket/useGameSocket.js";

const HangmanContext = createContext(null);

/**
 * @param {Record<string, unknown> | null} incoming
 * @param {{ setRoom: (r: Record<string, unknown> | null) => void, roomVersionRef: React.MutableRefObject<number>, roomCodeRef: React.MutableRefObject<string | null> }} ctx
 */
function mergeHangmanRoom(incoming, { setRoom, roomVersionRef, roomCodeRef }) {
  if (!incoming || typeof incoming !== "object") return;
  const incomingCode = typeof incoming.code === "string" ? incoming.code : null;
  const previousCode = roomCodeRef.current;
  const nextVersion = Number(incoming.stateVersion || 0);
  if (previousCode && incomingCode && previousCode !== incomingCode) {
    roomVersionRef.current = 0;
  }
  if (incomingCode !== previousCode) {
    roomCodeRef.current = incomingCode;
  }
  if (nextVersion < roomVersionRef.current) return;
  roomVersionRef.current = nextVersion;
  setRoom(incoming);
}

export function HangmanProvider({ children }) {
  const { user, loading } = useUser();
  const [roomNotice, setRoomNotice] = useState(/** @type {string | null} */ (null));

  const onRoomUpdate = useCallback((payload) => {
    const reason = payload?.reason;
    if (reason === "turn_skipped") {
      setRoomNotice("Turn skipped — time ran out");
    } else if (reason === "setter_timeout") {
      setRoomNotice("Setter ran out of time — a random word was chosen");
    }
  }, []);

  const socket = useGameSocket({
    namespace: "/hangman",
    gameTag: "hangman",
    mapGame: "hangman",
    enabled: Boolean(!loading && user?.id && getSocketBase()),
    trackSyncState: true,
    mergeRoom: mergeHangmanRoom,
    onRoomUpdate,
  });

  const applyRoomSnapshot = socket.applyRoom;

  const value = useMemo(
    () => ({
      room: socket.room,
      connected: socket.connected,
      connectionState: socket.connectionState,
      syncState: socket.syncState,
      socketError: socket.socketError,
      socketErrorCode: socket.socketErrorCode,
      reconnectedAt: socket.reconnectedAt,
      roomNotice,
      clearRoomNotice: () => setRoomNotice(null),
      localUserId: user?.id ?? null,
      localUsername: user?.username ?? "",
      createRoom: socket.createRoom,
      joinRoom: socket.joinRoom,
      leaveRoom: socket.leaveRoom,
      applyRoomSnapshot,
      send: socket.send,
      setReady: (ready) => socket.send("set_ready", { ready }),
      startGame: () => socket.send("start_game", {}),
      guessLetter: (letter) => socket.send("guess_letter", { letter }),
      getRoomState: () => socket.send("get_room_state", {}),
      retryConnection: socket.retryConnection,
    }),
    [
      socket.room,
      socket.connected,
      socket.connectionState,
      socket.syncState,
      socket.socketError,
      socket.socketErrorCode,
      socket.reconnectedAt,
      roomNotice,
      user?.id,
      user?.username,
      socket.createRoom,
      socket.joinRoom,
      socket.leaveRoom,
      applyRoomSnapshot,
      socket.send,
      socket.retryConnection,
    ],
  );

  return <HangmanContext.Provider value={value}>{children}</HangmanContext.Provider>;
}

export function useHangman() {
  const ctx = useContext(HangmanContext);
  if (!ctx) throw new Error("useHangman must be used within HangmanProvider");
  return ctx;
}
