"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { useGameSession } from "../session/GameSessionContext.jsx";
import { clearActiveGameRoom } from "../session/useActiveGameRoom.js";
import { useActiveGameRoom } from "../session/useActiveGameRoom.js";
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
  const { holdActive } = useGameSession();
  const [roomNotice, setRoomNotice] = useState(/** @type {string | null} */ (null));

  const onRoomUpdate = useCallback((payload) => {
    const reason = payload?.reason;
    const room = /** @type {{ players?: Array<{ userId?: string, username?: string, presenceStatus?: string, graceSecondsRemaining?: number }> } | undefined} */ (
      payload?.room
    );
    if (reason === "player_disconnect_pending" && room?.players?.length) {
      const pending = room.players.filter((p) => p.presenceStatus === "disconnect_pending");
      if (pending.length === 1) {
        const name = pending[0]?.username ?? "A player";
        const sec = pending[0]?.graceSecondsRemaining ?? 60;
        setRoomNotice(`${name} disconnected — rejoining (${sec}s)`);
      } else if (pending.length > 1) {
        setRoomNotice(`${pending.length} players reconnecting…`);
      }
      return;
    }
    if (reason === "member_disconnected" && room?.players?.length) {
      const gone = room.players.filter((p) => p.presenceStatus === "gone");
      if (gone.length === 1) {
        setRoomNotice(`${gone[0]?.username ?? "A player"} left the game`);
      }
      return;
    }
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
    enabled: Boolean(!loading && getSocketBase() && (user?.id || holdActive)),
    trackSyncState: true,
    mergeRoom: mergeHangmanRoom,
    onRoomUpdate,
  });

  const applyRoomSnapshot = socket.applyRoom;
  const roomCode = typeof socket.room?.code === "string" ? socket.room.code : null;
  useActiveGameRoom("hangman", roomCode);

  const leaveRoom = useCallback(async () => {
    const result = await socket.leaveRoom();
    clearActiveGameRoom("hangman", user?.id);
    return result;
  }, [socket.leaveRoom, user?.id]);

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
      leaveRoom,
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
      holdActive,
      user?.id,
      user?.username,
      socket.createRoom,
      socket.joinRoom,
      leaveRoom,
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
