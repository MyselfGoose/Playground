"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getSocketBase } from "../api.js";
import { useUser } from "../context/UserContext.jsx";
import { useGameSocket } from "../socket/useGameSocket.js";

const TabooContext = createContext(null);

export function TabooProvider({ children }) {
  const { user, loading } = useUser();
  const [categories, setCategories] = useState([]);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);

  const mergeTabooRoom = useCallback((incoming, { setRoom, roomVersionRef }) => {
    if (!incoming || typeof incoming !== "object") return;
    const sn = /** @type {{ serverNow?: number }} */ (incoming).serverNow;
    if (typeof sn === "number") {
      setServerOffsetMs(sn - Date.now());
    }
    const nextVersion = Number(incoming.stateVersion || 0);
    const prevVersion = Number(roomVersionRef.current || 0);
    if (nextVersion < prevVersion) return;
    roomVersionRef.current = nextVersion;
    setRoom(incoming);
  }, []);

  const socket = useGameSocket({
    namespace: "/taboo",
    gameTag: "taboo",
    mapGame: "taboo",
    enabled: Boolean(!loading && user && getSocketBase()),
    mergeRoom: mergeTabooRoom,
  });

  const serverNow = useCallback(() => Date.now() + serverOffsetMs, [serverOffsetMs]);

  useEffect(() => {
    if (!socket.room) {
      setServerOffsetMs(0);
      setCategories([]);
    }
  }, [socket.room]);

  const getCategories = useCallback(async () => {
    const result = await socket.send("get_categories", {});
    if (result.ok) {
      setCategories(Array.isArray(result.data?.categories) ? result.data.categories : []);
    }
    return result;
  }, [socket.send]);

  const value = useMemo(
    () => ({
      room: socket.room,
      connected: socket.connected,
      connectionState: socket.connectionState,
      socketError: socket.socketError,
      socketErrorCode: socket.socketErrorCode,
      reconnectedAt: socket.reconnectedAt,
      serverOffsetMs,
      serverNow,
      localUserId: user?.id ?? null,
      localUsername: user?.username ?? "",
      categories,
      createRoom: socket.createRoom,
      joinRoom: socket.joinRoom,
      leaveRoom: socket.leaveRoom,
      getCategories,
      setReady: (ready) => socket.send("set_ready", { ready }),
      changeTeam: (team) => socket.send("change_team", { team }),
      setCategories: (categoryMode, categoryIds) =>
        socket.send("set_categories", { categoryMode, categoryIds }),
      startGame: () => socket.send("start_game", {}),
      startTurn: () => socket.send("start_turn", {}),
      holdTurnStart: () => socket.send("hold_turn_start", {}),
      submitGuess: (guess) => socket.send("submit_guess", { guess }),
      skipCard: () => socket.send("skip_card", {}),
      tabooCalled: () => socket.send("taboo_called", {}),
      requestReview: () => socket.send("request_review", {}),
      dismissReview: () => socket.send("dismiss_review", {}),
      reviewVote: (vote) => socket.send("review_vote", { vote }),
      reviewContinue: () => socket.send("review_continue", {}),
      returnToLobby: () => socket.send("return_to_lobby", {}),
      retryConnection: socket.retryConnection,
    }),
    [
      socket.room,
      socket.connected,
      socket.connectionState,
      socket.socketError,
      socket.socketErrorCode,
      socket.reconnectedAt,
      serverOffsetMs,
      serverNow,
      user?.id,
      user?.username,
      categories,
      socket.createRoom,
      socket.joinRoom,
      socket.leaveRoom,
      getCategories,
      socket.send,
      socket.retryConnection,
    ],
  );

  return <TabooContext.Provider value={value}>{children}</TabooContext.Provider>;
}

export function useTaboo() {
  const ctx = useContext(TabooContext);
  if (!ctx) throw new Error("useTaboo must be used within TabooProvider");
  return ctx;
}
