"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "../lib/api.js";

const BOARD_PATHS = {
  global: "/api/v1/leaderboard/global",
  "typing-wpm": "/api/v1/leaderboard/typing/wpm",
  "typing-accuracy": "/api/v1/leaderboard/typing/accuracy",
  npat: "/api/v1/leaderboard/npat",
};

/**
 * @param {keyof typeof BOARD_PATHS} board
 * @param {number} page
 */
export function useLeaderboard(board, page = 1) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [data, setData] = useState(/** @type {{ entries: unknown[], total: number, page: number } | null} */ (null));
  const cacheRef = useRef(/** @type {Map<string, unknown>} */ (new Map()));

  const fetchBoard = useCallback(async () => {
    const key = `${board}:${page}`;
    const cached = cacheRef.current.get(key);
    if (cached) {
      setData(cached);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const path = BOARD_PATHS[board];
      if (!path) throw new Error(`Unknown board: ${board}`);
      const json = await apiFetch(`${path}?page=${page}&limit=25`);
      const result = json?.data ?? { entries: [], total: 0, page: 1 };
      cacheRef.current.set(key, result);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leaderboard");
    } finally {
      setLoading(false);
    }
  }, [board, page]);

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  return { loading, error, data, refetch: fetchBoard };
}

/**
 * @returns {{ loading: boolean, error: string | null, data: Record<string, unknown> | null }}
 */
export function useMyStats() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const json = await apiFetch("/api/v1/leaderboard/me");
        if (!cancelled) setData(json?.data ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load stats");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { loading, error, data };
}

/**
 * @param {string | null | undefined} userId
 * @returns {{ loading: boolean, error: string | null, data: Record<string, unknown> | null }}
 */
export function useUserProfile(userId) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [data, setData] = useState(/** @type {Record<string, unknown> | null} */ (null));
  const cacheRef = useRef(/** @type {Map<string, unknown>} */ (new Map()));

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setError("Missing user ID");
      return;
    }
    let cancelled = false;
    (async () => {
      const key = `profile:${userId}`;
      const cached = cacheRef.current.get(key);
      if (cached) {
        if (!cancelled) {
          setData(cached);
          setLoading(false);
          setError(null);
        }
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const json = await apiFetch(`/api/v1/users/${encodeURIComponent(userId)}/profile`);
        const next = json?.data ?? null;
        cacheRef.current.set(key, next);
        if (!cancelled) setData(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { loading, error, data };
}
