"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { useGameSession } from "../session/GameSessionContext.jsx";
import { clearActiveGameRoom, useActiveGameRoom } from "../session/useActiveGameRoom.js";
import { mergeRoomByStateVersion, useGameSocket } from "../socket/useGameSocket.js";

const FibbageContext = createContext(null);

export function FibbageProvider({ children }) {
  const { user, loading } = useUser();
  const { holdActive } = useGameSession();
  const [categories, setCategories] = useState(/** @type {string[]} */ ([]));

  const socket = useGameSocket({
    namespace: "/fibbage",
    gameTag: "fibbage",
    mapGame: "fibbage",
    enabled: Boolean(!loading && getSocketBase() && (user?.id || holdActive)),
    trackSyncState: true,
    mergeRoom: mergeRoomByStateVersion,
  });

  const roomCode = typeof socket.room?.code === "string" ? socket.room.code : null;
  useActiveGameRoom("fibbage", roomCode);

  const leaveRoom = useCallback(async () => {
    const result = await socket.leaveRoom();
    clearActiveGameRoom("fibbage", user?.id);
    return result;
  }, [socket.leaveRoom, user?.id]);

  const getCategories = useCallback(async () => {
    const result = await socket.send("get_categories", {});
    if (result.ok && Array.isArray(result.data?.categories)) {
      setCategories(result.data.categories);
    }
    return result;
  }, [socket.send]);

  const value = useMemo(
    () => ({
      room: socket.room,
      connected: socket.connected,
      connectionState: socket.connectionState,
      syncState: socket.syncState,
      socketError: socket.socketError,
      socketErrorCode: socket.socketErrorCode,
      reconnectedAt: socket.reconnectedAt,
      localUserId: user?.id ?? null,
      localUsername: user?.username ?? "",
      createRoom: socket.createRoom,
      joinRoom: socket.joinRoom,
      leaveRoom,
      setReady: (/** @type {boolean} */ ready) => socket.send("set_ready", { ready }),
      updateSettings: (/** @type {Record<string, unknown>} */ patch) => socket.send("update_settings", patch),
      startGame: () => socket.send("start_game", {}),
      submitLie: (/** @type {string} */ text) => socket.send("submit_lie", { text }),
      castVote: (/** @type {string} */ answerId) => socket.send("cast_vote", { answerId }),
      getRoomState: () => socket.send("get_room_state", {}),
      returnToLobby: () => socket.send("return_to_lobby", {}),
      getCategories,
      categories,
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
      categories,
      user?.id,
      user?.username,
      socket.createRoom,
      socket.joinRoom,
      leaveRoom,
      holdActive,
      socket.send,
      getCategories,
      socket.retryConnection,
    ],
  );

  return <FibbageContext.Provider value={value}>{children}</FibbageContext.Provider>;
}

export function useFibbage() {
  const ctx = useContext(FibbageContext);
  if (!ctx) throw new Error("useFibbage must be used within FibbageProvider");
  return ctx;
}
