"use client";

import { useEffect } from "react";
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
  const { setActiveRoom } = useGameSession();

  useEffect(() => {
    const code = roomCode ? String(roomCode).trim() : "";
    if (code) {
      persistLastRoomCode(gameId, code);
      setActiveRoom(gameId, code);
      setAccessTokenSchedulerInGame({ inGame: true });
      return () => {
        setAccessTokenSchedulerInGame({ inGame: false });
      };
    }
    setActiveRoom(gameId, null);
    setAccessTokenSchedulerInGame({ inGame: false });
    return undefined;
  }, [gameId, roomCode, setActiveRoom]);
}

/**
 * @param {string} gameId
 */
export function clearActiveGameRoom(gameId) {
  clearLastRoomCode(gameId);
  setAccessTokenSchedulerInGame({ inGame: false });
}
