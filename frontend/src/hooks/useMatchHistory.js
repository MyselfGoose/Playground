"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";

/**
 * @param {string | null | undefined} userId
 * @param {{ limit?: number }} [options]
 */
export function useMatchHistory(userId, { limit = 10 } = {}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [matches, setMatches] = useState(/** @type {Array<Record<string, unknown>>} */ ([]));

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setMatches([]);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const json = await apiFetch(
          `/api/v1/users/${encodeURIComponent(userId)}/matches?limit=${limit}`,
        );
        if (!cancelled) {
          setMatches(Array.isArray(json?.data?.matches) ? json.data.matches : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load match history");
          setMatches([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, limit]);

  return { loading, error, matches };
}
