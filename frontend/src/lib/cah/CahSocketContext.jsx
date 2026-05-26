"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { useGameSession } from "../session/GameSessionContext.jsx";
import { clearActiveGameRoom } from "../session/useActiveGameRoom.js";
import { useActiveGameRoom } from "../session/useActiveGameRoom.js";
import { mergeRoomByStateVersion, useGameSocket } from "../socket/useGameSocket.js";

const CahContext = createContext(null);

export function CahProvider({ children }) {
  const { user, loading } = useUser();
  const { holdActive } = useGameSession();
  const [packs, setPacks] = useState(/** @type {{ pack: string }[]} */ ([]));

  const socket = useGameSocket({
    namespace: "/cah",
    gameTag: "cah",
    mapGame: "cah",
    enabled: Boolean(!loading && getSocketBase() && (user?.id || holdActive)),
    trackSyncState: true,
    mergeRoom: mergeRoomByStateVersion,
  });

  const roomCode = typeof socket.room?.code === "string" ? socket.room.code : null;
  useActiveGameRoom("cah", roomCode);

  const leaveRoom = useCallback(async () => {
    const result = await socket.leaveRoom();
    if (result.ok) clearActiveGameRoom("cah");
    return result;
  }, [socket.leaveRoom]);

  const getPacks = useCallback(async () => {
    const result = await socket.send("get_packs", {});
    if (result.ok && Array.isArray(result.data?.packs)) {
      setPacks(result.data.packs);
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
      setReady: (ready) => socket.send("set_ready", { ready }),
      updateSettings: (patch) => socket.send("update_settings", patch),
      startGame: () => socket.send("start_game", {}),
      submitCards: (cardIds) => socket.send("submit_cards", { cardIds }),
      judgePickWinner: (submissionId) => socket.send("judge_pick_winner", { submissionId }),
      nextRound: () => socket.send("next_round", {}),
      getRoomState: () => socket.send("get_room_state", {}),
      returnToLobby: () => socket.send("return_to_lobby", {}),
      getPacks,
      packs,
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
      packs,
      user?.id,
      user?.username,
      socket.createRoom,
      socket.joinRoom,
      leaveRoom,
      holdActive,
      socket.send,
      getPacks,
      socket.retryConnection,
    ],
  );

  return <CahContext.Provider value={value}>{children}</CahContext.Provider>;
}

export function useCah() {
  const ctx = useContext(CahContext);
  if (!ctx) throw new Error("useCah must be used within CahProvider");
  return ctx;
}
