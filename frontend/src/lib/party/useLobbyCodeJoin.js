"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

/** @typedef {'idle' | 'joining' | 'ready' | 'failed'} JoinPhase */

/**
 * Auto-join a room when landing on a lobby URL with `?code=`.
 * @param {{
 *   connected: boolean,
 *   currentRoomCode: string | null | undefined,
 *   joinRoom: (code: string) => Promise<{ ok: boolean, error?: { message?: string } }>,
 *   normalizeUrlCode?: (raw: string) => string | null,
 * }} options
 */
export function useLobbyCodeJoin({ connected, currentRoomCode, joinRoom, normalizeUrlCode }) {
  const searchParams = useSearchParams();
  const rawCode = searchParams.get("code") ?? "";

  const urlCode = useMemo(() => {
    if (!rawCode.trim()) return null;
    if (normalizeUrlCode) return normalizeUrlCode(rawCode);
    return rawCode.trim().toUpperCase();
  }, [rawCode, normalizeUrlCode]);

  const [joinPhase, setJoinPhase] = useState(/** @type {JoinPhase} */ ("idle"));
  const [joinError, setJoinError] = useState(/** @type {string | null} */ (null));
  const [retryToken, setRetryToken] = useState(0);

  const retryJoin = useCallback(() => setRetryToken((t) => t + 1), []);

  const hasPendingInviteCode = Boolean(urlCode) && currentRoomCode !== urlCode;
  const isJoining = hasPendingInviteCode && (joinPhase === "idle" || joinPhase === "joining");

  useEffect(() => {
    if (!urlCode || !connected) return;

    if (currentRoomCode === urlCode) {
      setJoinPhase("ready");
      setJoinError(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      setJoinPhase("joining");
      setJoinError(null);
      const result = await joinRoom(urlCode);
      if (cancelled) return;
      if (result.ok) {
        setJoinPhase("ready");
      } else {
        setJoinPhase("failed");
        setJoinError(result.error?.message ?? "Could not join room");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urlCode, connected, currentRoomCode, joinRoom, retryToken]);

  return {
    urlCode,
    joinPhase,
    joinError,
    retryJoin,
    hasPendingInviteCode,
    isJoining,
  };
}
