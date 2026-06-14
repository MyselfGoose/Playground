"use client";

import { useEffect } from "react";
import { useUser } from "../context/UserContext.jsx";
import { setAccessTokenSchedulerInGame } from "./accessTokenScheduler.js";
import { useGameSession } from "./GameSessionContext.jsx";
import { clearLastRoomCode, persistLastRoomCode } from "./RoomSession.js";

/**
 * Persist room code and boost proactive token refresh while in a multiplayer room.
 *
 * @param {string} gameId
 * @param {string | null | undefined} roomCode
 */
export function useActiveGameRoom(gameId, roomCode) {
  const { user } = useUser();
  const userId = user?.id ?? null;
  const { setActiveRoom } = useGameSession();

  useEffect(() => {
    const code = roomCode ? String(roomCode).trim() : "";
    if (code && userId) {
      persistLastRoomCode(gameId, code, userId);
      setActiveRoom(gameId, code);
      setAccessTokenSchedulerInGame({ inGame: true });
      return () => {
        setAccessTokenSchedulerInGame({ inGame: false });
      };
    }
    if (userId) {
      clearLastRoomCode(gameId, userId);
    }
    setActiveRoom(gameId, null);
    setAccessTokenSchedulerInGame({ inGame: false });
    return undefined;
  }, [gameId, roomCode, userId, setActiveRoom]);
}

/**
 * @param {string} gameId
 * @param {string | null | undefined} [userId]
 */
export function clearActiveGameRoom(gameId, userId) {
  clearLastRoomCode(gameId, userId);
  setAccessTokenSchedulerInGame({ inGame: false });
}
